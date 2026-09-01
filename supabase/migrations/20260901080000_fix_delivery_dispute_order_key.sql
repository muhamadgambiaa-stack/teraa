-- order_delivery_issues is keyed by order_id, not by a separate id column.
create or replace function public.enforce_delivery_dispute_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue record;
  v_count integer := 0;
  v_reason text;
begin
  for v_issue in
    select i.order_id, i.seller_id
    from public.order_delivery_issues i
    where i.status::text = 'open'
      and i.seller_responded_at is null
      and i.auto_restricted_at is null
      and i.response_deadline <= now()
    for update skip locked
  loop
    v_reason := 'Automatically restricted for not responding within 48 hours to delivery dispute for order #' ||
      left(v_issue.order_id::text, 8) || '.';

    update public.users
    set
      account_status = 'restricted',
      restriction_reason = v_reason,
      restricted_at = now(),
      restricted_by = null
    where id = v_issue.seller_id
      and account_status = 'active';

    update public.sellers
    set
      account_status = 'suspended',
      admin_note = v_reason,
      status_updated_at = now(),
      status_updated_by = null
    where id = v_issue.seller_id
      and account_status = 'active';

    update public.order_delivery_issues
    set auto_restricted_at = now()
    where order_id = v_issue.order_id;

    insert into public.notifications (user_id, type, title, message, link)
    select
      u.id,
      'delivery_dispute',
      'Seller automatically restricted',
      v_reason,
      '/admin/disputes'
    from public.users u
    where u.role::text = 'admin';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enforce_delivery_dispute_deadlines()
from public, anon, authenticated;
