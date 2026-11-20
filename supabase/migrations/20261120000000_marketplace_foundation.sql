-- Marketplace foundation: applications, payments and the server-side actions
-- for the pay-to-unlock booking flow.
--
-- Additive only. Nothing here changes what existing pages can read or write;
-- the RLS lockdown ships separately with the new frontend.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

-- Departments sign in through a server-issued session tied to this user.
alter table public.hospital_departments
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists password_hash text;

update public.hospital_departments
set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
where password_hash is null and password is not null;

-- Professionals see the area on the duty itself, never the hospitals table.
alter table public.locum_duties add column if not exists area text;

update public.locum_duties l
set area = h.area
from public.hospitals h
where h.id = l.hospital_id and l.area is null;

create or replace function public.locum_duties_set_area() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select area into new.area from hospitals where id = new.hospital_id;
  return new;
end $$;

drop trigger if exists locum_duties_set_area on public.locum_duties;
create trigger locum_duties_set_area
  before insert or update of hospital_id on public.locum_duties
  for each row execute function public.locum_duties_set_area();

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

create table if not exists public.duty_applications (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.locum_duties(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('doctor', 'nurse', 'technician')),
  status text not null default 'applied'
    check (status in ('applied', 'withdrawn', 'selected', 'not_selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duty_id, provider_id)
);
create index if not exists duty_applications_provider_idx on public.duty_applications (provider_id);

create table if not exists public.duty_payments (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.locum_duties(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  paid_at timestamptz,
  decision_deadline timestamptz,
  outcome text not null default 'pending'
    check (outcome in ('pending', 'selected', 'refund_claimed', 'refunded', 'credited', 'forfeited')),
  created_at timestamptz not null default now()
);
create unique index if not exists duty_payments_one_paid
  on public.duty_payments (duty_id) where status = 'paid';

-- Only server-side functions write these tables.
alter table public.duty_applications enable row level security;
alter table public.duty_payments enable row level security;
revoke all on public.duty_applications, public.duty_payments from anon, authenticated;
grant select on public.duty_applications, public.duty_payments to authenticated;
-- (read policies are added after the helper functions below)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

-- The hospital the caller acts for: the hospital account itself, or a department of it.
create or replace function public.my_hospital_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from hospitals where id = auth.uid() and status = 'active'),
    (select d.hospital_id
       from hospital_departments d join hospitals h on h.id = d.hospital_id
      where d.auth_user_id = auth.uid() and h.status = 'active')
  );
$$;

create or replace function public.my_provider_type() returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from doctors where id = auth.uid() and status = 'active') then 'doctor'
    when exists (select 1 from nurses where id = auth.uid() and status = 'active') then 'nurse'
    when exists (select 1 from technicians where id = auth.uid() and status = 'active') then 'technician'
  end;
$$;

-- One row per professional, whatever their role. Lives in the private schema so
-- the API never exposes it; only security-definer functions read it.
create or replace view private.providers as
  select id, 'doctor'::text as provider_type, first_name, last_name, email, phone,
         qualification, additional_qualifications, experience, status,
         coalesce(flagged, false) as flagged,
         nmc_registration_number as registration_number,
         state_medical_council as registration_council, document_url
    from public.doctors
  union all
  select id, 'nurse', first_name, last_name, email, phone,
         qualification, additional_qualifications, experience, status,
         coalesce(flagged, false), registration_number, state_nursing_council, document_url
    from public.nurses
  union all
  select id, 'technician', first_name, last_name, email, phone,
         qualification, null::text[], experience, status,
         coalesce(flagged, false), registration_number, null, document_url
    from public.technicians;

-- Main qualification plus profile additions (stored as "degree||certificatePath").
create or replace function private.qualifications_of(p private.providers) returns text[]
language sql immutable as $$
  select array_remove(
    array[p.qualification]
      || coalesce(array(select split_part(q, '||', 1) from unnest(p.additional_qualifications) q), '{}'),
    null);
$$;

create or replace function private.certificates_of(p private.providers) returns text[]
language sql immutable as $$
  select array_remove(
    array[p.document_url]
      || coalesce(array(select split_part(q, '||', 2) from unnest(p.additional_qualifications) q), '{}'),
    null);
$$;

-- Duty shift as a time range in IST; an end time at or before the start means it ends next day.
create or replace function private.duty_period(d public.locum_duties) returns tstzrange
language plpgsql stable as $$
declare
  s time;
  e time;
begin
  begin
    s := coalesce(nullif(d.start_time, ''), '00:00')::time;
    e := coalesce(nullif(d.end_time, ''), '23:59')::time;
  exception when others then
    s := '00:00'; e := '23:59';
  end;
  return tstzrange(
    (d.date + s) at time zone 'Asia/Kolkata',
    (d.date + e + case when e <= s then interval '1 day' else interval '0' end) at time zone 'Asia/Kolkata');
end $$;

create or replace function private.provider_matches_duty(p private.providers, d public.locum_duties) returns boolean
language sql stable as $$
  select case p.provider_type
    when 'doctor' then coalesce(d.duty_type, 'doctor') in ('doctor', 'consultation')
      and (d.qualification = any (private.qualifications_of(p))
           or coalesce(d.qualifications, '{}') && private.qualifications_of(p))
    when 'nurse' then d.duty_type = 'nurse'
    when 'technician' then d.duty_type = 'technician'
      and d.qualification = any (private.qualifications_of(p))
    else false
  end;
$$;

create or replace function private.provider_is_busy(p_provider uuid, p_period tstzrange, p_except uuid default null)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.locum_duties x
     where x.booked_by = p_provider
       and x.booking_status = 'confirmed'
       and x.id is distinct from p_except
       and private.duty_period(x) && p_period);
$$;

-- Lets the lockdown trigger tell server-side actions apart from direct client updates.
create or replace function private.trust_this_transaction() returns void
language sql as $$ select set_config('locum.trusted', 'on', true); $$;

create policy "Professionals read their own applications" on public.duty_applications
  for select to authenticated using (provider_id = auth.uid() or public.is_admin());
create policy "Hospitals read their own duty payments" on public.duty_payments
  for select to authenticated using (hospital_id = public.my_hospital_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Professional actions
-- ---------------------------------------------------------------------------

create or replace function public.apply_to_duty(p_duty_id uuid) returns public.duty_applications
language plpgsql security definer set search_path = public as $$
declare
  me private.providers;
  d locum_duties;
  app duty_applications;
begin
  select * into me from private.providers where id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Only active professionals can apply for duties' using errcode = '42501';
  end if;

  select * into d from locum_duties where id = p_duty_id for update;
  if not found or d.booking_status <> 'open' or d.date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This duty is no longer open';
  end if;
  if not private.provider_matches_duty(me, d) then
    raise exception 'Your registered qualifications do not match this duty';
  end if;
  if private.provider_is_busy(me.id, private.duty_period(d)) then
    raise exception 'You already have a confirmed duty at this time';
  end if;

  insert into duty_applications (duty_id, provider_id, provider_type)
  values (p_duty_id, me.id, me.provider_type)
  on conflict (duty_id, provider_id) do update
    set status = 'applied', updated_at = now()
    where duty_applications.status = 'withdrawn'
  returning * into app;

  if found then
    insert into notifications (user_id, title, message)
    values (d.hospital_id, '🙋 New applicant',
            format('A professional applied for your %s duty on %s.', d.qualification, to_char(d.date, 'DD Mon YYYY')));
  else
    select * into app from duty_applications where duty_id = p_duty_id and provider_id = me.id;
  end if;
  return app;
end $$;

create or replace function public.withdraw_application(p_duty_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update duty_applications
     set status = 'withdrawn', updated_at = now()
   where duty_id = p_duty_id and provider_id = auth.uid() and status = 'applied';
  if not found then
    raise exception 'You have no open application for this duty';
  end if;
end $$;

-- Confirmed and completed bookings, with the hospital revealed.
create or replace function public.get_my_bookings()
returns table (
  duty_id uuid, date date, start_time text, end_time text, qualification text,
  duty_type text, pay numeric, notes text, booking_status text, completed boolean,
  hospital_name text, area text, address text, hospital_phone text, contact_person text,
  department_name text)
language sql stable security definer set search_path = public as $$
  select d.id, d.date, d.start_time, d.end_time, d.qualification, d.duty_type,
         coalesce(d.doctor_pay, d.gross_pay, d.pay), d.notes, d.booking_status, coalesce(d.completed, false),
         h.hospital_name, h.area, h.address, h.phone, h.contact_person, hd.department_name
    from locum_duties d
    join hospitals h on h.id = d.hospital_id
    left join hospital_departments hd on hd.id = d.department_id
   where d.booked_by = auth.uid()
     and d.booking_status = 'confirmed'
   order by d.date;
$$;

-- ---------------------------------------------------------------------------
-- Hospital actions
-- ---------------------------------------------------------------------------

-- Applicant counts and payment state for the caller's duties (dashboard list).
create or replace function public.get_duty_overview()
returns table (duty_id uuid, applicants integer, paid boolean, decision_deadline timestamptz, outcome text)
language sql stable security definer set search_path = public as $$
  select d.id,
         (select count(*)::int from duty_applications a
           where a.duty_id = d.id and a.status in ('applied', 'selected')),
         p.id is not null,
         p.decision_deadline,
         p.outcome
    from locum_duties d
    left join duty_payments p on p.duty_id = d.id and p.status = 'paid'
   where d.hospital_id = my_hospital_id();
$$;

-- Applicants for one duty. Anonymous until the fee is paid; contact details
-- only for the applicant the hospital selects.
create or replace function public.get_duty_applicants(p_duty_id uuid)
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
  d locum_duties;
  unlocked boolean;
begin
  select * into d from locum_duties where id = p_duty_id;
  if not found or (d.hospital_id is distinct from my_hospital_id() and not is_admin()) then
    raise exception 'Duty not found' using errcode = '42501';
  end if;
  unlocked := is_admin()
    or exists (select 1 from duty_payments where duty_id = d.id and status = 'paid');

  return query
  select a.id, a.status, a.created_at, p.provider_type,
         p.qualification, private.qualifications_of(p), p.experience,
         (select count(*)::int from locum_duties x where x.booked_by = p.id and x.completed),
         (select count(*)::int from locum_duties x where x.booked_by = p.id and x.review_status = 'satisfactory'),
         p.flagged,
         exists (select 1 from locum_duties x
                  where x.booked_by = p.id and x.hospital_id = d.hospital_id
                    and x.booking_status = 'confirmed' and x.id <> d.id),
         case when unlocked then p.first_name end,
         case when unlocked then p.last_name end,
         case when unlocked then p.registration_number end,
         case when unlocked then p.registration_council end,
         case when unlocked then private.certificates_of(p) end,
         case when unlocked and a.status = 'selected' then p.phone end,
         case when unlocked and a.status = 'selected' then p.email end
    from duty_applications a
    join private.providers p on p.id = a.provider_id
   where a.duty_id = d.id and a.status in ('applied', 'selected', 'not_selected')
   order by a.created_at;
end $$;

create or replace function public.select_applicant(p_application_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  app duty_applications;
  d locum_duties;
  pay duty_payments;
begin
  select * into app from duty_applications where id = p_application_id;
  if not found then raise exception 'Applicant not found'; end if;

  select * into d from locum_duties where id = app.duty_id for update;
  if d.hospital_id is distinct from my_hospital_id() then
    raise exception 'Applicant not found' using errcode = '42501';
  end if;
  if d.booking_status <> 'open' then raise exception 'This duty has already been filled'; end if;

  select * into pay from duty_payments where duty_id = d.id and status = 'paid';
  if not found then raise exception 'Pay the platform fee to select an applicant'; end if;
  if pay.outcome <> 'pending' then raise exception 'This duty''s payment has already been settled'; end if;
  if pay.decision_deadline is not null and now() > pay.decision_deadline then
    raise exception 'The 24-hour window to select an applicant has passed';
  end if;
  if app.status <> 'applied' then raise exception 'This applicant has withdrawn'; end if;
  if private.provider_is_busy(app.provider_id, private.duty_period(d)) then
    raise exception 'This professional has since been booked for another duty at the same time';
  end if;

  perform private.trust_this_transaction();

  update locum_duties
     set booking_status = 'confirmed', booked = true, booked_by = app.provider_id,
         payment_status = 'paid', locked_at = now()
   where id = d.id;
  update duty_applications set status = 'selected', updated_at = now() where id = app.id;
  update duty_applications set status = 'not_selected', updated_at = now()
   where duty_id = d.id and id <> app.id and status = 'applied';
  update duty_payments set outcome = 'selected' where id = pay.id;

  -- The selected professional's other applications that clash with this shift.
  update duty_applications o set status = 'withdrawn', updated_at = now()
    from locum_duties x
   where o.provider_id = app.provider_id and o.status = 'applied'
     and x.id = o.duty_id and x.id <> d.id
     and private.duty_period(x) && private.duty_period(d);

  insert into notifications (user_id, title, message)
  select app.provider_id, '✅ Duty confirmed',
         format('You have been selected for the %s duty on %s at %s. Open My Locums for the hospital''s details.',
                d.qualification, to_char(d.date, 'DD Mon YYYY'), coalesce(d.area, 'the hospital'));
  insert into notifications (user_id, title, message)
  select a.provider_id, 'Duty filled',
         format('The %s duty on %s has been filled by another professional.', d.qualification, to_char(d.date, 'DD Mon YYYY'))
    from duty_applications a
   where a.duty_id = d.id and a.status = 'not_selected';
end $$;

create or replace function public.submit_duty_review(p_duty_id uuid, p_status text, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d locum_duties;
  reason text;
begin
  if p_status not in ('satisfactory', 'late', 'absent', 'unsatisfactory') then
    raise exception 'Unknown review status';
  end if;
  select * into d from locum_duties where id = p_duty_id for update;
  if not found or d.hospital_id is distinct from my_hospital_id() then
    raise exception 'Duty not found' using errcode = '42501';
  end if;
  if d.booking_status <> 'confirmed' or coalesce(d.completed, false) then
    raise exception 'Only confirmed duties that are not yet reviewed can be reviewed';
  end if;
  if d.date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'You can review a duty once its date has passed';
  end if;

  perform private.trust_this_transaction();
  update locum_duties
     set review_status = p_status, review_comment = p_comment,
         reviewed_at = now(), completed = true
   where id = d.id;

  if p_status <> 'satisfactory' then
    reason := case p_status
      when 'late' then 'Late to duty'
      when 'absent' then 'Absent from duty'
      else 'Unsatisfactory: ' || coalesce(p_comment, '') end;
    update doctors set flagged = true, flag_reason = reason,
           flagged_by = (select hospital_name from hospitals where id = d.hospital_id)
     where id = d.booked_by;
    update nurses set flagged = true, flag_reason = reason,
           flagged_by = (select hospital_name from hospitals where id = d.hospital_id)
     where id = d.booked_by;
    update technicians set flagged = true, flag_reason = reason,
           flagged_by = (select hospital_name from hospitals where id = d.hospital_id)
     where id = d.booked_by;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------

-- Called only by the department-login edge function (service role).
create or replace function public.verify_department_login(p_code text, p_password text)
returns table (department_id uuid, hospital_id uuid, auth_user_id uuid, department_name text,
               hospital_name text, hospital_status text)
language sql stable security definer set search_path = public as $$
  select d.id, d.hospital_id, d.auth_user_id, d.department_name, h.hospital_name, h.status
    from hospital_departments d join hospitals h on h.id = d.hospital_id
   where d.department_code = upper(trim(p_code))
     and d.password_hash = extensions.crypt(p_password, d.password_hash);
$$;

create or replace function public.set_department_password(p_department_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  update hospital_departments
     set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         password = null
   where id = p_department_id
     and (auth_user_id = auth.uid() or hospital_id = auth.uid() or is_admin());
  if not found then raise exception 'Department not found' using errcode = '42501'; end if;
end $$;

-- Default departments get unguessable codes, e.g. APOLLO-ICU-7KQ2.
create or replace function public.create_default_departments(hosp_id uuid, hosp_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  dept_names text[] := array[
    'ICU', 'OT', 'Emergency', 'Paediatrics',
    'Obstetrics & Gynaecology', 'Orthopaedics',
    'General Medicine', 'General Surgery',
    'Radiology', 'Pathology', 'Cardiology', 'Neurology'
  ];
  dept text;
  code_prefix text;
begin
  if not is_admin() then
    raise exception 'Only admins can create departments' using errcode = '42501';
  end if;
  code_prefix := upper(regexp_replace(left(hosp_name, 6), '[^A-Za-z0-9]', '', 'g'));
  foreach dept in array dept_names loop
    insert into hospital_departments (hospital_id, department_name, department_code, password_hash, fixed_pay)
    values (hosp_id, dept,
            code_prefix || '-' || upper(regexp_replace(dept, '[^A-Za-z0-9]', '', 'g'))
              || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)),
            extensions.crypt('123456', extensions.gen_salt('bf')), 0)
    on conflict (department_code) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.verify_department_login(text, text) from public, anon, authenticated;
grant execute on function public.verify_department_login(text, text) to service_role;
revoke execute on function
  public.apply_to_duty(uuid), public.withdraw_application(uuid), public.get_my_bookings(),
  public.get_duty_overview(), public.get_duty_applicants(uuid), public.select_applicant(uuid),
  public.submit_duty_review(uuid, text, text), public.set_department_password(uuid, text),
  public.create_default_departments(uuid, text)
  from public, anon;
grant execute on function
  public.apply_to_duty(uuid), public.withdraw_application(uuid), public.get_my_bookings(),
  public.get_duty_overview(), public.get_duty_applicants(uuid), public.select_applicant(uuid),
  public.submit_duty_review(uuid, text, text), public.set_department_password(uuid, text),
  public.create_default_departments(uuid, text)
  to authenticated;
