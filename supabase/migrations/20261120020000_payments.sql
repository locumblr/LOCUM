-- Platform-fee payments: recorded only by the payment edge functions after
-- Razorpay's signature is verified, plus the 24-hour decision deadline.

-- Called by verify-payment / razorpay-webhook (service role) once Razorpay's
-- signature checks out. Idempotent: a second call for the same order is a no-op.
create or replace function public.record_duty_payment(p_order_id text, p_payment_id text)
returns public.duty_payments
language plpgsql security definer set search_path = public as $$
declare
  pay duty_payments;
  d locum_duties;
begin
  select * into pay from duty_payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'Unknown order %', p_order_id; end if;
  if pay.status = 'paid' then return pay; end if;

  select * into d from locum_duties where id = pay.duty_id;

  -- The hospital has 24 hours to choose, or until the duty starts if sooner.
  update duty_payments
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(),
         decision_deadline = least(now() + interval '24 hours', lower(private.duty_period(d)))
   where id = pay.id
  returning * into pay;

  perform private.notify_hospital(d, '💳 Payment received',
    format('Thank you. Rs.%s received for the %s duty on %s. Review the applicants and select one before %s.',
           to_char(pay.amount_paise / 100.0, 'FM99,99,999'), d.qualification, to_char(d.date, 'DD Mon YYYY'),
           to_char(pay.decision_deadline at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM')));
  return pay;
end $$;

-- A paid duty whose deadline passes with no selection or refund claim closes
-- unfilled and the fee is forfeited (per the refund policy shown before paying).
create or replace function public.process_payment_deadlines() returns integer
language plpgsql security definer set search_path = public as $$
declare
  pay duty_payments;
  d locum_duties;
  n integer := 0;
begin
  perform private.trust_this_transaction();
  for pay in
    select * from duty_payments
     where status = 'paid' and outcome = 'pending' and decision_deadline < now()
     for update skip locked
  loop
    select * into d from locum_duties where id = pay.duty_id;
    update duty_payments set outcome = 'forfeited' where id = pay.id;
    update locum_duties set booking_status = 'expired' where id = d.id and booking_status = 'open';
    update duty_applications set status = 'not_selected', updated_at = now()
     where duty_id = d.id and status = 'applied';
    insert into notifications (user_id, title, message)
    select a.provider_id, 'Duty closed',
           format('The %s duty on %s has closed without a selection.', d.qualification, to_char(d.date, 'DD Mon YYYY'))
      from duty_applications a where a.duty_id = d.id and a.status = 'not_selected';
    perform private.notify_hospital(d, '⏰ Selection window closed',
      format('No applicant was selected or refund requested for the %s duty on %s within the deadline, so the duty has closed and the platform fee is non-refundable.',
             d.qualification, to_char(d.date, 'DD Mon YYYY')));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.record_duty_payment(text, text), public.process_payment_deadlines()
  from public, anon, authenticated;
grant execute on function public.record_duty_payment(text, text), public.process_payment_deadlines()
  to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'process-payment-deadlines';
select cron.schedule('process-payment-deadlines', '*/10 * * * *', 'select public.process_payment_deadlines()');
