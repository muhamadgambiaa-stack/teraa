-- A buyer may complete an order only after the seller has explicitly
-- confirmed delivery. This guard also protects direct API updates.
create or replace function public.require_seller_delivery_before_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.buyer_id
     and not public.current_user_is_admin()
     and new.status::text = 'completed'
     and old.status::text <> 'delivered' then
    raise exception
      'The seller must confirm delivery before the buyer can complete this order.';
  end if;

  return new;
end;
$$;

drop trigger if exists require_seller_delivery_before_completion on public.orders;

create trigger require_seller_delivery_before_completion
before update on public.orders
for each row
execute function public.require_seller_delivery_before_completion();
