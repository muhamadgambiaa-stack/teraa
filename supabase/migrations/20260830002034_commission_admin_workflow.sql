create or replace function public.admin_provide_commission_instructions(
  p_commission_id uuid,
  p_instructions text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_commission public.commissions%rowtype;
  v_instructions text := btrim(coalesce(p_instructions, ''));
  v_pause_duration interval;
begin
  if v_admin_id is null
     or not public.current_user_is_admin() then
    raise exception 'admin_required'
      using errcode = '42501';
  end if;

  if char_length(v_instructions) < 5
     or char_length(v_instructions) > 2000 then
    raise exception 'invalid_payment_instructions'
      using errcode = '22023';
  end if;

  select *
  into v_commission
  from public.commissions
  where id = p_commission_id
  for update;

  if not found then
    raise exception 'commission_not_found';
  end if;

  if v_commission.status <> 'instructions_requested'
     or v_commission.deadline_paused_at is null then
    raise exception 'instructions_not_requested';
  end if;

  v_pause_duration := now() - v_commission.deadline_paused_at;

  update public.commissions
  set
    status = 'awaiting_payment',
    payment_instructions = v_instructions,
    instructions_provided_at = now(),
    due_at = due_at + v_pause_duration,
    deadline_paused_at = null,
    updated_at = now()
  where id = p_commission_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link
  )
  values (
    v_commission.seller_id,
    'commission_instructions_provided',
    'Commission payment details available',
    'Teraa provided the requested payment instructions. Your payment deadline has resumed.',
    '/seller/dashboard/commissions'
  );
end;
$$;

revoke all
on function public.admin_provide_commission_instructions(uuid, text)
from public, anon;

grant execute
on function public.admin_provide_commission_instructions(uuid, text)
to authenticated;

create or replace function public.admin_review_commission_payment(
  p_commission_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_commission public.commissions%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_pause_duration interval;
begin
  if v_admin_id is null
     or not public.current_user_is_admin() then
    raise exception 'admin_required'
      using errcode = '42501';
  end if;

  if v_decision not in ('approve', 'reject', 'waive') then
    raise exception 'invalid_review_decision'
      using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'admin_note_too_long'
      using errcode = '22023';
  end if;

  select *
  into v_commission
  from public.commissions
  where id = p_commission_id
  for update;

  if not found then
    raise exception 'commission_not_found';
  end if;

  if v_decision in ('approve', 'reject')
     and v_commission.status <> 'proof_submitted' then
    raise exception 'payment_proof_not_pending_review';
  end if;

  if v_decision = 'waive'
     and v_commission.status in ('paid', 'waived') then
    raise exception 'commission_already_closed';
  end if;

  if v_decision = 'approve' then
    update public.commissions
    set
      status = 'paid',
      seller_payout_status = 'paid',
      payout_reference = proof_path,
      paid_at = now(),
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      admin_note = v_note,
      deadline_paused_at = null,
      updated_at = now()
    where id = p_commission_id;

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      v_commission.seller_id,
      'commission_payment_approved',
      'Commission payment approved',
      'Teraa confirmed your commission payment.',
      '/seller/dashboard/commissions'
    );

  elsif v_decision = 'reject' then
    if v_note is null then
      raise exception 'rejection_reason_required'
        using errcode = '22023';
    end if;

    v_pause_duration :=
      case
        when v_commission.deadline_paused_at is null
          then interval '0 seconds'
        else now() - v_commission.deadline_paused_at
      end;

    update public.commissions
    set
      status = 'rejected',
      due_at = due_at + v_pause_duration,
      deadline_paused_at = null,
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      admin_note = v_note,
      updated_at = now()
    where id = p_commission_id;

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      v_commission.seller_id,
      'commission_payment_rejected',
      'Commission proof rejected',
      'Teraa could not verify your payment proof. Open Commissions to review the reason and submit new proof.',
      '/seller/dashboard/commissions'
    );

  else
    update public.commissions
    set
      status = 'waived',
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      admin_note = v_note,
      deadline_paused_at = null,
      updated_at = now()
    where id = p_commission_id;

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      v_commission.seller_id,
      'commission_waived',
      'Commission waived',
      'Teraa waived this commission charge. No payment is required.',
      '/seller/dashboard/commissions'
    );
  end if;
end;
$$;

revoke all
on function public.admin_review_commission_payment(uuid, text, text)
from public, anon;

grant execute
on function public.admin_review_commission_payment(uuid, text, text)
to authenticated;