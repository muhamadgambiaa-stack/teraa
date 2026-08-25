create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> v_order.buyer_id
     and auth.uid() <> v_order.seller_id then
    raise exception 'You are not allowed to cancel this order';
  end if;

  if v_order.status not in ('placed', 'confirmed') then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  for v_item in
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
  loop
    update public.products
    set
      stock_quantity = stock_quantity + v_item.quantity,
      status = case
        when status = 'out_of_stock' then 'active'
        else status
      end
    where id = v_item.product_id;
  end loop;
end;
$$;

grant execute
on function public.cancel_order(uuid)
to authenticated;