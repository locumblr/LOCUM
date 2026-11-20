-- Refund claims: a hospital that paid but finds no applicant suitable gives a
-- reason for each one; an admin reviews and either refunds (cash or credit)
-- or upholds the forfeit.

create table if not exists public.refund_claims (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.locum_duties(id) on delete restrict,
  payment_id uuid not null unique references public.duty_payments(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  -- [{application_id, reason}] for every applicant the hospital rejected
  reasons jsonb not null,
  applicant_count integer not null,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  resolution text check (resolution in ('refund', 'credit')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create table if not exists public.hospital_credits (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  reason text not null,
  source_payment_id uuid references public.duty_payments(id),
  used_on_duty_id uuid references public.locum_duties(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.refund_claims enable row level security;
alter table public.hospital_credits enable row level security;
revoke all on public.refund_claims, public.hospital_credits from anon, authenticated;
grant select on public.refund_claims, public.hospital_credits to authenticated;
create policy "Own claims or admin" on public.refund_claims
  for select to authenticated using (hospital_id = public.my_hospital_id() or public.is_admin());
create policy "Own credits or admin" on public.hospital_credits
  for select to authenticated using (hospital_id = public.my_hospital_id() or public.is_admin());

-- The hospital (main account) rejects every applicant with a reason each.
-- p_reasons: {"<application_id>": "reason", ...}
create or replace function public.submit_refund_claim(p_duty_id uuid, p_reasons jsonb)
returns public.refund_claims
language plpgsql security definer set search_path = public as $$
declare
  d locum_duties;
  pay duty_payments;
  claim refund_claims;
  app record;
  reasons jsonb := '[]'::jsonb;
  n integer := 0;
begin
  select * into d from locum_duties where id = p_duty_id for update;
  if not found or d.hospital_id is distinct from auth.uid() then
    raise exception 'Only the hospital''s main account can request a refund review' using errcode = '42501';
  end if;
  if d.booking_status <> 'open' then raise exception 'This duty has already been filled or closed'; end if;

  select * into pay from duty_payments where duty_id = d.id and status = 'paid' for update;
  if not found then raise exception 'No payment found for this duty'; end if;
  if pay.outcome <> 'pending' then raise exception 'This payment has already been settled'; end if;
  if pay.decision_deadline is not null and now() > pay.decision_deadline then
    raise exception 'The 24-hour window to request a review has passed';
  end if;

  for app in select id from duty_applications where duty_id = d.id and status = 'applied' loop
    if length(trim(coalesce(p_reasons ->> app.id::text, ''))) < 10 then
      raise exception 'Give a reason (at least 10 characters) for each applicant';
    end if;
    reasons := reasons || jsonb_build_object('application_id', app.id, 'reason', trim(p_reasons ->> app.id::text));
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'There are no applicants to reject'; end if;

  perform private.trust_this_transaction();
  insert into refund_claims (duty_id, payment_id, hospital_id, reasons, applicant_count)
  values (d.id, pay.id, d.hospital_id, reasons, n)
  returning * into claim;
  update duty_payments set outcome = 'refund_claimed' where id = pay.id;
  update locum_duties set booking_status = 'expired' where id = d.id;
  update duty_applications set status = 'not_selected', updated_at = now()
   where duty_id = d.id and status = 'applied';

  insert into notifications (user_id, title, message)
  select a.provider_id, 'Duty closed',
         format('The %s duty on %s has closed without a selection.', d.qualification, to_char(d.date, 'DD Mon YYYY'))
    from duty_applications a where a.duty_id = d.id and a.status = 'not_selected';
  insert into notifications (user_id, title, message)
  select ad.id, case when n > 1 then '🚩 Refund review — all ' || n || ' applicants rejected' else '🔎 Refund review requested' end,
         format('%s rejected %s applicant(s) for the %s duty on %s and asked for a refund of Rs.%s. Review in the admin panel.',
                (select hospital_name from hospitals where id = d.hospital_id), n, d.qualification,
                to_char(d.date, 'DD Mon YYYY'), to_char(pay.amount_paise / 100.0, 'FM99,99,999'))
    from admins ad;
  perform private.notify_hospital(d, 'Refund review requested',
    'Our team will review your reasons against the applicants'' credentials and let you know the outcome.');
  return claim;
end $$;

-- Admins see each claim with the applicants' credentials and the hospital's reasons.
create or replace function public.get_refund_claims(p_status text default 'open')
returns table (
  claim_id uuid, status text, created_at timestamptz, hospital_name text,
  duty_id uuid, qualification text, duty_date date, amount_paise integer,
  applicant_count integer, reasons jsonb, applicants jsonb, resolution text, admin_note text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  select c.id, c.status, c.created_at, h.hospital_name, d.id, d.qualification, d.date,
         p.amount_paise, c.applicant_count, c.reasons,
         (select jsonb_agg(jsonb_build_object(
                   'application_id', a.id, 'name', pr.first_name || ' ' || pr.last_name,
                   'provider_type', pr.provider_type, 'qualifications', private.qualifications_of(pr),
                   'experience', pr.experience, 'registration_number', pr.registration_number,
                   'registration_council', pr.registration_council,
                   'certificates', private.certificates_of(pr), 'flagged', pr.flagged))
            from duty_applications a join private.providers pr on pr.id = a.provider_id
           where a.duty_id = d.id and a.status = 'not_selected'),
         c.resolution, c.admin_note
    from refund_claims c
    join locum_duties d on d.id = c.duty_id
    join duty_payments p on p.id = c.payment_id
    join hospitals h on h.id = c.hospital_id
   where p_status is null or c.status = p_status
   order by c.created_at;
end $$;

-- Admin decision. Approve: 'credit' adds hospital credit now; 'refund' marks the
-- payment for a Razorpay refund, which the admin issues from the Razorpay dashboard.
create or replace function public.resolve_refund_claim(p_claim_id uuid, p_approve boolean, p_resolution text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c refund_claims;
  pay duty_payments;
  d locum_duties;
begin
  if not is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into c from refund_claims where id = p_claim_id for update;
  if not found or c.status <> 'open' then raise exception 'Claim not found or already resolved'; end if;
  if p_approve and p_resolution not in ('refund', 'credit') then raise exception 'Choose refund or credit'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Add a note explaining the decision'; end if;

  select * into pay from duty_payments where id = c.payment_id for update;
  select * into d from locum_duties where id = c.duty_id;

  update refund_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolution = case when p_approve then p_resolution end,
         admin_note = trim(p_note), resolved_at = now(), resolved_by = auth.uid()
   where id = c.id;

  if p_approve and p_resolution = 'credit' then
    update duty_payments set outcome = 'credited' where id = pay.id;
    insert into hospital_credits (hospital_id, amount_paise, reason, source_payment_id)
    values (c.hospital_id, pay.amount_paise,
            format('Refund review approved for the %s duty on %s', d.qualification, to_char(d.date, 'DD Mon YYYY')), pay.id);
  elsif p_approve then
    update duty_payments set outcome = 'refunded' where id = pay.id;
  else
    update duty_payments set outcome = 'forfeited' where id = pay.id;
  end if;

  perform private.notify_hospital(d,
    case when p_approve then '✅ Refund review approved' else 'Refund review outcome' end,
    case
      when p_approve and p_resolution = 'credit' then
        format('Rs.%s has been added as credit for your next booking. Note from LOCUM: %s', to_char(pay.amount_paise / 100.0, 'FM99,99,999'), trim(p_note))
      when p_approve then
        format('Rs.%s will be refunded to your original payment method within 5–7 working days. Note from LOCUM: %s', to_char(pay.amount_paise / 100.0, 'FM99,99,999'), trim(p_note))
      else
        format('After reviewing the applicants'' credentials, the platform fee for the %s duty on %s is non-refundable. Note from LOCUM: %s', d.qualification, to_char(d.date, 'DD Mon YYYY'), trim(p_note))
    end);
end $$;

revoke execute on function
  public.submit_refund_claim(uuid, jsonb), public.get_refund_claims(text),
  public.resolve_refund_claim(uuid, boolean, text, text)
  from public, anon;
grant execute on function
  public.submit_refund_claim(uuid, jsonb), public.get_refund_claims(text),
  public.resolve_refund_claim(uuid, boolean, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Spending credit instead of paying through Razorpay
-- ---------------------------------------------------------------------------

create or replace function public.get_credit_balance()
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount_paise), 0)::int
    from hospital_credits
   where hospital_id = my_hospital_id() and used_at is null;
$$;

-- Pays a duty's fee from unused credit (main hospital account only). Leftover
-- credit is kept as a new credit entry.
create or replace function public.pay_with_credit(p_duty_id uuid)
returns public.duty_payments
language plpgsql security definer set search_path = public as $$
declare
  d locum_duties;
  fee integer;
  balance integer;
  pay duty_payments;
begin
  select * into d from locum_duties where id = p_duty_id for update;
  if not found or d.hospital_id is distinct from auth.uid() then
    raise exception 'Only the hospital''s main account can pay' using errcode = '42501';
  end if;
  if d.booking_status <> 'open' then raise exception 'This duty is no longer open'; end if;
  if exists (select 1 from duty_payments where duty_id = d.id and status = 'paid') then
    raise exception 'This duty''s fee has already been paid';
  end if;
  if not exists (select 1 from duty_applications where duty_id = d.id and status = 'applied') then
    raise exception 'You can pay once at least one professional has applied';
  end if;

  fee := round(d.platform_fee * 100);
  select coalesce(sum(amount_paise), 0) into balance
    from hospital_credits where hospital_id = d.hospital_id and used_at is null;
  if balance < fee then raise exception 'Not enough credit for this duty'; end if;

  update hospital_credits set used_at = now(), used_on_duty_id = d.id
   where hospital_id = d.hospital_id and used_at is null;
  if balance > fee then
    insert into hospital_credits (hospital_id, amount_paise, reason)
    values (d.hospital_id, balance - fee, 'Credit remaining after paying for a duty');
  end if;

  insert into duty_payments (duty_id, hospital_id, amount_paise, razorpay_order_id, status)
  values (d.id, d.hospital_id, fee, 'credit_' || d.id, 'created');
  return public.record_duty_payment('credit_' || d.id, 'credit');
end $$;

revoke execute on function public.get_credit_balance(), public.pay_with_credit(uuid) from public, anon;
grant execute on function public.get_credit_balance(), public.pay_with_credit(uuid) to authenticated;
