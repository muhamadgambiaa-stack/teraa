alter table public.order_delivery_issues
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_reason text;

alter table public.order_delivery_issues
  drop constraint if exists order_delivery_issues_resolution_reason_length_check,
  add constraint order_delivery_issues_resolution_reason_length_check
    check (
      resolution_reason is null
      or char_length(btrim(resolution_reason)) between 3 and 500
    );

-- Preserve an honest reason for older resolved cases without inventing a date.
update public.order_delivery_issues as issue
set resolution_reason = case
  when orders.status::text = 'completed'
    then 'Buyer confirmed receipt.'
  when orders.status::text = 'cancelled'
    then 'Order was cancelled.'
  else 'Resolved before resolution tracking was enabled.'
end
from public.orders as orders
where orders.id = issue.order_id
  and issue.status::text = 'resolved'
  and issue.resolution_reason is null;

create or replace function public.record_delivery_dispute_resolution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order_status text;
begin
  if new.status::text = 'resolved'
     and old.status::text is distinct from 'resolved' then
    select o.status::text
    into v_order_status
    from public.orders o
    where o.id = new.order_id;

    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolution_reason := coalesce(
      nullif(btrim(new.resolution_reason), ''),
      case
        when v_order_status = 'completed' then 'Buyer confirmed receipt.'
        when v_order_status = 'cancelled' then 'Order was cancelled.'
        else 'Delivery dispute resolved.'
      end
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_delivery_dispute_resolution()
from public, anon, authenticated;

drop trigger if exists record_delivery_dispute_resolution
on public.order_delivery_issues;

create trigger record_delivery_dispute_resolution
before update of status on public.order_delivery_issues
for each row
execute function public.record_delivery_dispute_resolution();
