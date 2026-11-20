-- The professional currently booked on a confirmed duty, for that duty's hospital.
-- After a cover swap this is the replacement, not the original applicant.

create or replace function public.get_booked_professional(p_duty_id uuid)
returns table (
  provider_type text, first_name text, last_name text, qualification text,
  registration_number text, registration_council text, certificate_paths text[],
  phone text, email text)
language sql stable security definer set search_path = public as $$
  select p.provider_type, p.first_name, p.last_name, p.qualification,
         p.registration_number, p.registration_council, private.certificates_of(p),
         p.phone, p.email
    from locum_duties d
    join private.providers p on p.id = d.booked_by
   where d.id = p_duty_id
     and d.booking_status = 'confirmed'
     and (d.hospital_id = my_hospital_id() or is_admin());
$$;

revoke execute on function public.get_booked_professional(uuid) from public, anon;
grant execute on function public.get_booked_professional(uuid) to authenticated;
