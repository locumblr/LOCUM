-- RLS lockdown: every table only shows people what they are entitled to see.
--
-- Ship together with the frontend that uses the server-side actions from
-- 20261120000000_marketplace_foundation.sql. The old pages read other users'
-- rows directly and stop working once this is applied.

-- ---------------------------------------------------------------------------
-- Start from a clean slate on the tables we lock down
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'doctors', 'nurses', 'technicians', 'hospitals', 'locum_duties',
    'hospital_departments', 'monthly_invoices', 'cover_requests', 'notifications'
  ] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Nothing is readable or writable without logging in.
revoke all on
  public.doctors, public.nurses, public.technicians, public.hospitals, public.locum_duties,
  public.hospital_departments, public.monthly_invoices, public.cover_requests, public.notifications,
  public.push_subscriptions, public.subscriptions, public.admins,
  public.duty_applications, public.duty_payments
from anon;

-- Functions are executable by PUBLIC (which includes anon) by default.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.verify_department_login(text, text) from authenticated;

-- Plain-text department passwords are no longer used; logins check password_hash.
update public.hospital_departments set password = null;

-- Existing codes were built from the hospital and department names and could be
-- guessed. Give each a random suffix; hospitals see the new codes on their profile.
update public.hospital_departments
set department_code = department_code || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));

-- ---------------------------------------------------------------------------
-- Guards for columns only the server or an admin may change
-- ---------------------------------------------------------------------------

create or replace function private.is_trusted() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('locum.trusted', true), '') = 'on' or public.is_admin();
$$;

-- Trigger arguments name the protected columns.
create or replace function private.protect_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  col text;
begin
  if private.is_trusted() then return new; end if;
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'You cannot change %', col using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Professionals: see and edit only their own profile
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['doctors', 'nurses', 'technicians'] loop
    execute format($f$
      create policy "Own profile or admin" on public.%1$I
        for select to authenticated using (id = auth.uid() or public.is_admin());
      create policy "Register own profile" on public.%1$I
        for insert to authenticated
        with check (id = auth.uid() and status = 'active' and not coalesce(flagged, false));
      create policy "Edit own profile or admin" on public.%1$I
        for update to authenticated
        using (id = auth.uid() or public.is_admin())
        with check (id = auth.uid() or public.is_admin());
      create policy "Admins delete" on public.%1$I
        for delete to authenticated using (public.is_admin());
      drop trigger if exists protect_columns on public.%1$I;
      create trigger protect_columns before update on public.%1$I
        for each row execute function private.protect_columns(
          'id', 'status', 'flagged', 'flag_reason', 'flagged_by', 'created_at');
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Hospitals: own row; departments read their hospital; admins everything
-- ---------------------------------------------------------------------------

create policy "Own hospital or admin" on public.hospitals
  for select to authenticated
  using (id = auth.uid() or id = public.my_hospital_id() or public.is_admin());
create policy "Register own hospital" on public.hospitals
  for insert to authenticated with check (id = auth.uid() and status = 'pending');
create policy "Edit own hospital or admin" on public.hospitals
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "Admins delete" on public.hospitals
  for delete to authenticated using (public.is_admin());

drop trigger if exists protect_columns on public.hospitals;
create trigger protect_columns before update on public.hospitals
  for each row execute function private.protect_columns('id', 'status', 'subscription_end', 'created_at');

-- ---------------------------------------------------------------------------
-- Duties
-- ---------------------------------------------------------------------------

create policy "Read duties you may act on" on public.locum_duties
  for select to authenticated
  using (
    public.is_admin()
    or hospital_id = public.my_hospital_id()
    or (public.my_provider_type() is not null and (booking_status = 'open' or booked_by = auth.uid()))
  );
create policy "Post duties for your hospital" on public.locum_duties
  for insert to authenticated
  with check (
    hospital_id = public.my_hospital_id()
    and booking_status = 'open'
    and not coalesce(booked, false)
    and booked_by is null
    and (department_id is null
         or exists (select 1 from public.hospital_departments hd
                     where hd.id = department_id and hd.hospital_id = public.my_hospital_id()))
  );
create policy "Edit your hospital's duties" on public.locum_duties
  for update to authenticated
  using (hospital_id = public.my_hospital_id() or public.is_admin())
  with check (hospital_id = public.my_hospital_id() or public.is_admin());
create policy "Delete your open duties" on public.locum_duties
  for delete to authenticated
  using (public.is_admin() or (hospital_id = public.my_hospital_id() and booking_status = 'open'));

-- Fee is always 20% of gross pay, GST-inclusive, whatever the client sends.
create or replace function private.set_duty_fee() returns trigger
language plpgsql as $$
begin
  new.gross_pay := coalesce(new.gross_pay, new.pay);
  new.platform_fee := round(coalesce(new.gross_pay, 0) * 0.2);
  new.gst_on_fee := new.platform_fee - round(new.platform_fee / 1.18);
  return new;
end $$;

drop trigger if exists set_duty_fee on public.locum_duties;
create trigger set_duty_fee before insert or update of pay, gross_pay, platform_fee, gst_on_fee
  on public.locum_duties for each row execute function private.set_duty_fee();

-- Booking state only moves through the server-side actions.
create or replace function private.protect_duty() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.is_trusted() then return new; end if;
  if exists (select 1 from duty_payments where duty_id = old.id and status = 'paid') then
    raise exception 'A paid duty cannot be edited' using errcode = '42501';
  end if;
  if (new.booking_status, new.booked, new.booked_by, new.payment_status, new.locked_at,
      new.completed, new.review_status, new.review_comment, new.reviewed_at,
      new.hospital_id, new.department_id, new.payment_cleared_at)
     is distinct from
     (old.booking_status, old.booked, old.booked_by, old.payment_status, old.locked_at,
      old.completed, old.review_status, old.review_comment, old.reviewed_at,
      old.hospital_id, old.department_id, old.payment_cleared_at) then
    raise exception 'Booking status can only change through LOCUM''s booking flow' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_duty on public.locum_duties;
create trigger protect_duty before update on public.locum_duties
  for each row execute function private.protect_duty();

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------

create policy "Hospital, own department or admin" on public.hospital_departments
  for select to authenticated
  using (public.is_admin() or hospital_id = auth.uid() or auth_user_id = auth.uid());
create policy "Hospital or admin adds departments" on public.hospital_departments
  for insert to authenticated
  with check (public.is_admin() or hospital_id = auth.uid());
create policy "Hospital or admin edits departments" on public.hospital_departments
  for update to authenticated
  using (public.is_admin() or hospital_id = auth.uid())
  with check (public.is_admin() or hospital_id = auth.uid());
create policy "Hospital or admin removes departments" on public.hospital_departments
  for delete to authenticated
  using (public.is_admin() or hospital_id = auth.uid());

drop trigger if exists protect_columns on public.hospital_departments;
create trigger protect_columns before update on public.hospital_departments
  for each row execute function private.protect_columns(
    'hospital_id', 'department_code', 'password', 'password_hash', 'auth_user_id');

-- ---------------------------------------------------------------------------
-- Monthly invoices: hospitals see theirs and may only flag them as paid
-- ---------------------------------------------------------------------------

create policy "Own invoices or admin" on public.monthly_invoices
  for select to authenticated using (public.is_admin() or hospital_id = public.my_hospital_id());
create policy "Admins create invoices" on public.monthly_invoices
  for insert to authenticated with check (public.is_admin());
create policy "Hospital marks paid, admin edits" on public.monthly_invoices
  for update to authenticated
  using (public.is_admin() or hospital_id = auth.uid())
  with check (public.is_admin() or hospital_id = auth.uid());
create policy "Admins delete invoices" on public.monthly_invoices
  for delete to authenticated using (public.is_admin());

drop trigger if exists protect_columns on public.monthly_invoices;
create trigger protect_columns before update on public.monthly_invoices
  for each row execute function private.protect_columns(
    'hospital_id', 'billing_month', 'total_duties', 'total_gross', 'total_platform_fee',
    'fine_amount', 'total_due', 'status', 'due_date', 'paid_at', 'admin_verified', 'weeks_overdue');

-- ---------------------------------------------------------------------------
-- Cover requests: the people involved and admins. Created and resolved only
-- through the server actions in 20261120010000_cover_requests.sql.
-- ---------------------------------------------------------------------------

create policy "Involved professionals or admin" on public.cover_requests
  for select to authenticated
  using (public.is_admin() or requesting_doctor_id = auth.uid() or covering_doctor_id = auth.uid());
create policy "Admins manage cover requests" on public.cover_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications: your own; admins may notify anyone
-- ---------------------------------------------------------------------------

create policy "Read and update own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "Mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
create policy "Notify yourself or, as admin, anyone" on public.notifications
  for insert to authenticated with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Certificates in storage
-- ---------------------------------------------------------------------------

-- A hospital may open an applicant's certificates once it has paid for that duty.
create or replace function public.can_view_document(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from duty_applications a
      join duty_payments p on p.duty_id = a.duty_id and p.status = 'paid'
      join locum_duties d on d.id = a.duty_id
     where a.provider_id::text = split_part(p_name, '/', 2)
       and a.status in ('applied', 'selected', 'not_selected')
       and d.hospital_id = public.my_hospital_id());
$$;
revoke execute on function public.can_view_document(text) from public, anon;
grant execute on function public.can_view_document(text) to authenticated;

drop policy if exists "Allow reads" on storage.objects;
drop policy if exists "Allow uploads" on storage.objects;

create policy "Read own, paid applicants', or admin documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (split_part(name, '/', 2) = auth.uid()::text
         or public.is_admin()
         or public.can_view_document(name))
  );
create policy "Upload into own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1) in ('doctors', 'nurses', 'technicians', 'hospitals')
    and split_part(name, '/', 2) = auth.uid()::text
  );
create policy "Replace or remove own documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and split_part(name, '/', 2) = auth.uid()::text);
create policy "Remove own documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and split_part(name, '/', 2) = auth.uid()::text);
