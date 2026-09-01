alter table public.order_delivery_issues
  add column if not exists resolution_decision text,
  add column if not exists resolved_by uuid references public.users(id) on delete set null;

alter table public.order_delivery_issues
  drop constraint if exists order_delivery_issues_resolution_decision_check,
  add constraint order_delivery_issues_resolution_decision_check
    check (
      resolution_decision is null
      or resolution_decision in ('complete_order', 'cancel_order', 'dismiss_report')
    );

create or replace function public.admin_resolve_delivery_dispute(
  p_order_id uuid,
  p_decision text,
  p_note text,
  p_restore_seller boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_note text := btrim(coalesce(p_note, ''));
  v_issue public.order_delivery_issues%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_reason text;
begin
  if v_admin_id is null or not public.current_user_is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_decision not in ('complete_order', 'cancel_order', 'dismiss_report') then
    raise exception 'invalid_dispute_decision' using errcode = '22023';
  end if;

  if char_length(v_note) not between 10 and 500 then
    raise exception 'decision_note_must_be_between_10_and_500_characters'
      using errcode = '22023';
  end if;

  select * into v_issue
  from public.order_delivery_issues
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'delivery_issue_not_found';
  end if;

  if v_issue.status::text <> 'open' then
    raise exception 'delivery_issue_already_resolved';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if p_decision = 'complete_order' then
    if v_order.status::text = 'cancelled' then
      raise exception 'cancelled_order_cannot_be_completed';
    end if;

    update public.orders
    set
      status = 'completed'::public.order_status,
      payment_status = case
        when payment_method::text = 'cod' then 'paid'
        else payment_status
      end
    where id = p_order_id
      and status::text <> 'completed';

    v_reason := 'Admin confirmed delivery. ' || v_note;

  elsif p_decision = 'cancel_order' then
    if v_order.status::text = 'completed' then
      raise exception 'completed_order_cannot_be_cancelled';
    end if;

    if v_order.status::text <> 'cancelled' then
      update public.orders
      set status = 'cancelled'::public.order_status
      where id = p_order_id;

      for v_item in
        select product_id, quantity
        from public.order_items
        where order_id = p_order_id
      loop
        update public.products p
        set
          stock_quantity = p.stock_quantity + v_item.quantity,
          status = case
            when p.status::text = 'out_of_stock'
              and exists (
                select 1
                from public.sellers s
                join public.users u on u.id = s.id
                where s.id = p.seller_id
                  and s.verification_status::text = 'approved'
                  and s.account_status = 'active'
                  and u.account_status = 'active'
              )
            then 'active'::public.product_status
            else p.status
          end
        where p.id = v_item.product_id;
      end loop;
    end if;

    v_reason := 'Admin confirmed non-delivery and cancelled the order. ' || v_note;

  else
    v_reason := 'Admin dismissed the delivery report. ' || v_note;
  end if;

  update public.order_delivery_issues
  set
    status = 'resolved',
    resolution_decision = p_decision,
    resolution_reason = v_reason,
    resolved_at = now(),
    resolved_by = v_admin_id
  where order_id = p_order_id;

  if p_restore_seller and v_issue.auto_restricted_at is not null then
    update public.users
    set
      account_status = 'active',
      restriction_reason = null,
      restricted_at = null,
      restricted_by = null
    where id = v_issue.seller_id
      and account_status = 'restricted'
      and restriction_reason like
        'Automatically restricted for not responding within 48 hours to delivery dispute for order #%';

    update public.sellers
    set
      account_status = 'active',
      admin_note = null,
      status_updated_at = now(),
      status_updated_by = v_admin_id
    where id = v_issue.seller_id
      and account_status = 'suspended'
      and admin_note like
        'Automatically restricted for not responding within 48 hours to delivery dispute for order #%';
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values
    (
      v_issue.buyer_id,
      'delivery_dispute',
      'Delivery dispute resolved',
      v_reason,
      '/orders/' || p_order_id::text
    ),
    (
      v_issue.seller_id,
      'delivery_dispute',
      'Delivery dispute resolved',
      v_reason,
      '/seller/dashboard/orders/' || p_order_id::text
    );
end;
$$;

revoke all on function public.admin_resolve_delivery_dispute(uuid, text, text, boolean)
from public, anon;

grant execute on function public.admin_resolve_delivery_dispute(uuid, text, text, boolean)
to authenticated;
