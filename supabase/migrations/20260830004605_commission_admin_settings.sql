create or replace function public.admin_update_commission_settings(
  p_commission_rate numeric,
  p_payment_window_hours integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.current_user_is_admin() then
    raise exception 'admin_required'
      using errcode = '42501';
  end if;

  if p_commission_rate < 0.001 or p_commission_rate > 0.25 then
    raise exception 'Commission rate must be between 0.1% and 25%.'
      using errcode = '22023';
  end if;

  if p_payment_window_hours < 1 or p_payment_window_hours > 168 then
    raise exception 'Payment deadline must be between 1 and 168 hours.'
      using errcode = '22023';
  end if;

  update public.commission_settings
  set
    commission_rate = p_commission_rate,
    payment_window_hours = p_payment_window_hours,
    updated_at = now(),
    updated_by = v_user_id
  where id = true;

  if not found then
    raise exception 'Commission settings are missing.';
  end if;
end;
$$;

revoke all
on function public.admin_update_commission_settings(numeric, integer)
from public, anon;

grant execute
on function public.admin_update_commission_settings(numeric, integer)
to authenticated;

create or replace function public.create_commission_on_order_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric(6,5);
  v_window_hours integer;
  v_order_total numeric(14,2);
  v_commission_amount numeric(14,2);
  v_commission_id uuid;
  v_rate_label text;
begin
  if new.status::text <> 'completed'
     or old.status::text = 'completed' then
    return new;
  end if;

  select
    cs.commission_rate,
    cs.payment_window_hours
  into
    v_rate,
    v_window_hours
  from public.commission_settings cs
  where cs.id = true;

  if not found then
    raise exception 'Commission settings are missing.';
  end if;

  select coalesce(
    sum(oi.quantity * oi.price_at_purchase),
    0
  )::numeric(14,2)
  into v_order_total
  from public.order_items oi
  where oi.order_id = new.id;

  if v_order_total <= 0 then
    raise exception 'Cannot calculate commission for an empty order.';
  end if;

  v_commission_amount := round(v_order_total * v_rate, 2);

  insert into public.commissions (
    order_id,
    seller_id,
    order_total,
    commission_rate,
    commission_amount,
    seller_payout_status,
    status,
    due_at
  )
  values (
    new.id,
    new.seller_id,
    v_order_total,
    v_rate,
    v_commission_amount,
    'pending',
    'awaiting_payment',
    now() + make_interval(hours => v_window_hours)
  )
  on conflict (order_id) do nothing
  returning id into v_commission_id;

  if v_commission_id is not null then
    v_rate_label :=
      trim(trailing '.' from trim(trailing '0' from
        to_char(v_rate * 100, 'FM999990.00')
      ));

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      new.seller_id,
      'commission_created',
      'Commission payment required',
      format(
        'A %s%% Teraa commission is due within %s hour%s for a completed order.',
        v_rate_label,
        v_window_hours,
        case when v_window_hours = 1 then '' else 's' end
      ),
      '/seller/dashboard/commissions'
    );
  end if;

  return new;
end;
$$;

revoke all
on function public.create_commission_on_order_completion()
from public, anon, authenticated;
