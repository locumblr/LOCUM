-- Cover requests in the marketplace flow.
--
-- A booked professional asks for cover; they stay booked and responsible until
-- the hospital confirms a replacement from the cover applicants. The hospital
-- already paid for the duty, so cover applicants' credentials are visible to it
-- without a second fee; contact details only for the replacement it confirms.
--
-- Additive: existing pages are unaffected until the new frontend ships.

-- Requesters and covers can be any professional, not only doctors.
alter table public.cover_requests drop constraint if exists cover_requests_requesting_doctor_id_fkey;
alter table public.cover_requests drop constraint if exists cover_requests_covering_doctor_id_fkey;
alter table public.cover_requests
  add constraint cover_requests_requesting_doctor_id_fkey
    foreign key (requesting_doctor_id) references auth.users(id) on delete cascade,
  add constraint cover_requests_covering_doctor_id_fkey
    foreign key (covering_doctor_id) references auth.users(id) on delete set null;

alter table public.cover_requests
  add column if not exists resolved_at timestamptz;
alter table public.cover_requests alter column status set default 'open';
alter table public.cover_requests drop constraint if exists cover_requests_status_check;
alter table public.cover_requests
  add constraint cover_requests_status_check check (status in ('open', 'filled', 'cancelled', 'accepted'));  -- 'accepted': legacy pages
create unique index if not exists cover_requests_one_open_per_duty
  on public.cover_requests (duty_id) where status = 'open';

create table if not exists public.cover_applications (
  id uuid primary key default gen_random_uuid(),
  cover_request_id uuid not null references public.cover_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('doctor', 'nurse', 'technician')),
  status text not null default 'applied'
    check (status in ('applied', 'withdrawn', 'selected', 'not_selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cover_request_id, provider_id)
);
create index if not exists cover_applications_provider_idx on public.cover_applications (provider_id);

alter table public.cover_applications enable row level security;
revoke all on public.cover_applications from anon, authenticated;
grant select on public.cover_applications to authenticated;
create policy "Professionals read their own cover applications" on public.cover_applications
  for select to authenticated using (provider_id = auth.uid() or public.is_admin());

-- Notify the hospital account and, for department-posted duties, that department.
create or replace function private.notify_hospital(d public.locum_duties, p_title text, p_message text)
returns void language sql as $$
  insert into public.notifications (user_id, title, message)
  select d.hospital_id, p_title, p_message
  union
  select hd.auth_user_id, p_title, p_message
    from public.hospital_departments hd
   where hd.id = d.department_id and hd.auth_user_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- The booked professional
-- ---------------------------------------------------------------------------

create or replace function public.request_cover(p_duty_id uuid, p_reason text)
returns public.cover_requests
language plpgsql security definer set search_path = public as $$
declare
  d locum_duties;
  cr cover_requests;
begin
  select * into d from locum_duties where id = p_duty_id for update;
  if not found or d.booked_by is distinct from auth.uid() or d.booking_status <> 'confirmed' then
    raise exception 'You can only request cover for a duty you are booked on' using errcode = '42501';
  end if;
  if coalesce(d.completed, false) or d.date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This duty has already taken place';
  end if;
  if exists (select 1 from cover_requests where duty_id = d.id and status = 'open') then
    raise exception 'You have already requested cover for this duty';
  end if;

  insert into cover_requests (duty_id, requesting_doctor_id, reason, status)
  values (d.id, auth.uid(), nullif(trim(coalesce(p_reason, '')), ''), 'open')
  returning * into cr;

  perform private.notify_hospital(d, '🔁 Cover requested',
    format('The professional booked for your %s duty on %s has asked for cover%s. They remain responsible for the duty until you confirm a replacement. Review cover applicants in My Locums.',
           d.qualification, to_char(d.date, 'DD Mon YYYY'),
           coalesce(': "' || cr.reason || '"', '')));
  return cr;
end $$;

create or replace function public.cancel_cover_request(p_cover_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cr cover_requests;
  d locum_duties;
begin
  select * into cr from cover_requests where id = p_cover_request_id for update;
  if not found or cr.requesting_doctor_id is distinct from auth.uid() or cr.status <> 'open' then
    raise exception 'No open cover request found' using errcode = '42501';
  end if;
  update cover_requests set status = 'cancelled', resolved_at = now() where id = cr.id;
  update cover_applications set status = 'not_selected', updated_at = now()
   where cover_request_id = cr.id and status = 'applied';

  select * into d from locum_duties where id = cr.duty_id;
  perform private.notify_hospital(d, 'Cover request withdrawn',
    format('The cover request for your %s duty on %s was withdrawn. The originally booked professional will attend.',
           d.qualification, to_char(d.date, 'DD Mon YYYY')));
end $$;

-- ---------------------------------------------------------------------------
-- Professionals looking for cover work
-- ---------------------------------------------------------------------------

-- Open cover requests the caller qualifies for. Area only, never the hospital.
create or replace function public.get_open_cover_requests()
returns table (
  cover_request_id uuid, duty_id uuid, date date, start_time text, end_time text,
  qualification text, duty_type text, area text, pay numeric, notes text, reason text,
  my_application_status text)
language sql stable security definer set search_path = public as $$
  select cr.id, d.id, d.date, d.start_time, d.end_time, d.qualification, d.duty_type, d.area,
         coalesce(d.doctor_pay, d.gross_pay, d.pay), d.notes, cr.reason,
         (select ca.status from cover_applications ca
           where ca.cover_request_id = cr.id and ca.provider_id = auth.uid())
    from cover_requests cr
    join locum_duties d on d.id = cr.duty_id
    join private.providers me on me.id = auth.uid() and me.status = 'active'
   where cr.status = 'open'
     and cr.requesting_doctor_id <> auth.uid()
     and d.date >= (now() at time zone 'Asia/Kolkata')::date
     and private.provider_matches_duty(me, d)
   order by d.date;
$$;

create or replace function public.apply_for_cover(p_cover_request_id uuid)
returns public.cover_applications
language plpgsql security definer set search_path = public as $$
declare
  me private.providers;
  cr cover_requests;
  d locum_duties;
  app cover_applications;
begin
  select * into me from private.providers where id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Only active professionals can apply' using errcode = '42501';
  end if;
  select * into cr from cover_requests where id = p_cover_request_id for update;
  if not found or cr.status <> 'open' then raise exception 'This cover request is no longer open'; end if;
  if cr.requesting_doctor_id = me.id then raise exception 'You cannot cover your own duty'; end if;

  select * into d from locum_duties where id = cr.duty_id;
  if d.date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'This duty has already taken place'; end if;
  if not private.provider_matches_duty(me, d) then
    raise exception 'Your registered qualifications do not match this duty';
  end if;
  if private.provider_is_busy(me.id, private.duty_period(d)) then
    raise exception 'You already have a confirmed duty at this time';
  end if;

  insert into cover_applications (cover_request_id, provider_id, provider_type)
  values (cr.id, me.id, me.provider_type)
  on conflict (cover_request_id, provider_id) do update
    set status = 'applied', updated_at = now()
    where cover_applications.status = 'withdrawn'
  returning * into app;

  if found then
    perform private.notify_hospital(d, '🙋 New cover applicant',
      format('A professional applied to cover your %s duty on %s. Review them in My Locums.',
             d.qualification, to_char(d.date, 'DD Mon YYYY')));
  else
    select * into app from cover_applications where cover_request_id = cr.id and provider_id = me.id;
  end if;
  return app;
end $$;

create or replace function public.withdraw_cover_application(p_cover_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cover_applications set status = 'withdrawn', updated_at = now()
   where cover_request_id = p_cover_request_id and provider_id = auth.uid() and status = 'applied';
  if not found then raise exception 'You have no open cover application for this duty'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- The hospital
-- ---------------------------------------------------------------------------

-- Open cover requests on the caller's duties, with applicant counts.
create or replace function public.get_hospital_cover_requests()
returns table (cover_request_id uuid, duty_id uuid, reason text, created_at timestamp, applicants integer)
language sql stable security definer set search_path = public as $$
  select cr.id, cr.duty_id, cr.reason, cr.created_at,
         (select count(*)::int from cover_applications ca
           where ca.cover_request_id = cr.id and ca.status = 'applied')
    from cover_requests cr
    join locum_duties d on d.id = cr.duty_id
   where cr.status = 'open' and d.hospital_id = my_hospital_id();
$$;

-- Cover applicants with credentials; contact details only once confirmed.
create or replace function public.get_cover_applicants(p_cover_request_id uuid)
returns table (
  application_id uuid, status text, applied_at timestamptz, provider_type text,
  qualification text, qualifications text[], experience integer,
  duties_completed integer, satisfactory_reviews integer, flagged boolean,
  worked_with_you_before boolean,
  first_name text, last_name text, registration_number text, registration_council text,
  certificate_paths text[], phone text, email text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  cr cover_requests;
  d locum_duties;
begin
  select * into cr from cover_requests where id = p_cover_request_id;
  select * into d from locum_duties where id = cr.duty_id;
  if cr.id is null or (d.hospital_id is distinct from my_hospital_id() and not is_admin()) then
    raise exception 'Cover request not found' using errcode = '42501';
  end if;

  return query
  select a.id, a.status, a.created_at, p.provider_type,
         p.qualification, private.qualifications_of(p), p.experience,
         (select count(*)::int from locum_duties x where x.booked_by = p.id and x.completed),
         (select count(*)::int from locum_duties x where x.booked_by = p.id and x.review_status = 'satisfactory'),
         p.flagged,
         exists (select 1 from locum_duties x
                  where x.booked_by = p.id and x.hospital_id = d.hospital_id
                    and x.booking_status = 'confirmed' and x.id <> d.id),
         p.first_name, p.last_name, p.registration_number, p.registration_council,
         private.certificates_of(p),
         case when a.status = 'selected' then p.phone end,
         case when a.status = 'selected' then p.email end
    from cover_applications a
    join private.providers p on p.id = a.provider_id
   where a.cover_request_id = cr.id and a.status in ('applied', 'selected', 'not_selected')
   order by a.created_at;
end $$;

create or replace function public.confirm_cover(p_cover_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  app cover_applications;
  cr cover_requests;
  d locum_duties;
begin
  select * into app from cover_applications where id = p_cover_application_id;
  if not found then raise exception 'Applicant not found'; end if;
  select * into cr from cover_requests where id = app.cover_request_id for update;
  select * into d from locum_duties where id = cr.duty_id for update;
  if d.hospital_id is distinct from my_hospital_id() then
    raise exception 'Applicant not found' using errcode = '42501';
  end if;
  if cr.status <> 'open' then raise exception 'This cover request is no longer open'; end if;
  if app.status <> 'applied' then raise exception 'This applicant has withdrawn'; end if;
  if d.booking_status <> 'confirmed' or coalesce(d.completed, false) then
    raise exception 'This duty can no longer be covered';
  end if;
  if private.provider_is_busy(app.provider_id, private.duty_period(d), d.id) then
    raise exception 'This professional has since been booked for another duty at the same time';
  end if;

  perform private.trust_this_transaction();
  update locum_duties set booked_by = app.provider_id where id = d.id;
  update cover_requests
     set status = 'filled', covering_doctor_id = app.provider_id, resolved_at = now()
   where id = cr.id;
  update cover_applications set status = 'selected', updated_at = now() where id = app.id;
  update cover_applications set status = 'not_selected', updated_at = now()
   where cover_request_id = cr.id and id <> app.id and status = 'applied';

  -- The replacement's other applications that clash with this shift.
  update duty_applications o set status = 'withdrawn', updated_at = now()
    from locum_duties x
   where o.provider_id = app.provider_id and o.status = 'applied'
     and x.id = o.duty_id and private.duty_period(x) && private.duty_period(d);

  insert into notifications (user_id, title, message) values
    (cr.requesting_doctor_id, '✅ Cover confirmed',
     format('The hospital confirmed a replacement for your %s duty on %s. You are no longer responsible for it.',
            d.qualification, to_char(d.date, 'DD Mon YYYY'))),
    (app.provider_id, '✅ Cover confirmed',
     format('You are confirmed to cover the %s duty on %s at %s. Open My Locums for the hospital''s details.',
            d.qualification, to_char(d.date, 'DD Mon YYYY'), coalesce(d.area, 'the hospital')));
  insert into notifications (user_id, title, message)
  select a.provider_id, 'Cover filled',
         format('The %s duty on %s has been covered by another professional.', d.qualification, to_char(d.date, 'DD Mon YYYY'))
    from cover_applications a
   where a.cover_request_id = cr.id and a.status = 'not_selected';
end $$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.request_cover(uuid, text), public.cancel_cover_request(uuid),
  public.get_open_cover_requests(), public.apply_for_cover(uuid),
  public.withdraw_cover_application(uuid), public.get_hospital_cover_requests(),
  public.get_cover_applicants(uuid), public.confirm_cover(uuid)
  from public, anon;
grant execute on function
  public.request_cover(uuid, text), public.cancel_cover_request(uuid),
  public.get_open_cover_requests(), public.apply_for_cover(uuid),
  public.withdraw_cover_application(uuid), public.get_hospital_cover_requests(),
  public.get_cover_applicants(uuid), public.confirm_cover(uuid)
  to authenticated;
