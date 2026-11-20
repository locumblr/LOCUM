-- Server-side actions the profile page needs once tables are locked down.

-- Hospitals add a department: random code suffix, hashed default password.
create or replace function public.add_department(p_name text)
returns table (department_code text)
language plpgsql security definer set search_path = public as $$
declare
  h hospitals;
  code text;
begin
  select * into h from hospitals where id = auth.uid() and status = 'active';
  if not found then raise exception 'Only an approved hospital can add departments' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Enter a department name'; end if;

  code := upper(regexp_replace(left(h.hospital_name, 6), '[^A-Za-z0-9]', '', 'g'))
       || '-' || upper(left(regexp_replace(p_name, '[^A-Za-z0-9]', '', 'g'), 8))
       || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  insert into hospital_departments (hospital_id, department_name, department_code, password_hash, fixed_pay)
  values (h.id, trim(p_name), code, extensions.crypt('123456', extensions.gen_salt('bf')), 0);
  return query select code;
end $$;

-- Names of the professionals booked on the caller's duties, for the history list.
create or replace function public.get_booked_names()
returns table (duty_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select d.id,
         case when p.provider_type = 'doctor' then 'Dr. ' else '' end || p.first_name || ' ' || p.last_name
    from locum_duties d
    join private.providers p on p.id = d.booked_by
   where d.hospital_id = my_hospital_id()
     and d.booking_status = 'confirmed';
$$;

-- Tell admins when a hospital marks a monthly invoice as paid.
create or replace function private.notify_admins_invoice_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_requested and not coalesce(old.payment_requested, false) then
    insert into notifications (user_id, title, message)
    select a.id, '💰 Payment Received — Verification Required',
           format('%s has marked their %s invoice as paid. Total: Rs.%s. Please verify and mark as cleared.',
                  (select hospital_name from hospitals where id = new.hospital_id),
                  new.billing_month, new.total_due)
      from admins a;
  end if;
  return new;
end $$;

drop trigger if exists notify_admins_invoice_paid on public.monthly_invoices;
create trigger notify_admins_invoice_paid after update of payment_requested on public.monthly_invoices
  for each row execute function private.notify_admins_invoice_paid();

revoke execute on function public.add_department(text), public.get_booked_names() from public, anon;
grant execute on function public.add_department(text), public.get_booked_names() to authenticated;
