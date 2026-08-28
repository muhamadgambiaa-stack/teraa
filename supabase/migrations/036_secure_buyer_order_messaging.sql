-- ============================================================
-- TERAA
-- Secure buyer -> seller messaging from genuine orders
-- ============================================================


-- Remove the older duplicate / weaker insert policy.
drop policy if exists conversations_insert_buyer
on public.conversations;


-- ============================================================
-- BUYER OPENS CONVERSATION FROM A REAL ORDER
-- ============================================================

create or replace function public.buyer_open_order_conversation(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_product_id uuid;
  v_conversation_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;


  -- Buyer account must remain active.
  if not exists (
    select 1
    from public.users u
    where u.id = v_user_id
      and u.account_status = 'active'
  ) then
    raise exception 'Your Teraa account is not active.';
  end if;


  -- Load a genuine order owned by this buyer.
  select
    o.buyer_id,
    o.seller_id
  into
    v_buyer_id,
    v_seller_id
  from public.orders o
  where o.id = p_order_id
    and o.buyer_id = v_user_id
  limit 1;

  if v_buyer_id is null or v_seller_id is null then
    raise exception 'Order not found or buyer is not authorized.';
  end if;


  -- Seller must still be a valid active seller.
  if not exists (
    select 1
    from public.sellers s
    join public.users u
      on u.id = s.id
    where s.id = v_seller_id
      and s.verification_status::text = 'approved'
      and s.account_status = 'active'
      and u.account_status = 'active'
  ) then
    raise exception 'This seller account is currently unavailable.';
  end if;


  -- Get the product that genuinely belongs to this order.
  select
    oi.product_id
  into
    v_product_id
  from public.order_items oi
  join public.products p
    on p.id = oi.product_id
  where oi.order_id = p_order_id
    and p.seller_id = v_seller_id
  order by oi.product_id
  limit 1;

  if v_product_id is null then
    raise exception 'No valid product was found for this order.';
  end if;


  -- Reuse an existing conversation.
  select
    c.id
  into
    v_conversation_id
  from public.conversations c
  where c.buyer_id = v_buyer_id
    and c.seller_id = v_seller_id
    and c.product_id = v_product_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;


  -- Create one specifically because a genuine order exists.
  begin
    insert into public.conversations (
      buyer_id,
      seller_id,
      product_id
    )
    values (
      v_buyer_id,
      v_seller_id,
      v_product_id
    )
    returning id
    into v_conversation_id;

  exception
    when unique_violation then
      select
        c.id
      into
        v_conversation_id
      from public.conversations c
      where c.buyer_id = v_buyer_id
        and c.seller_id = v_seller_id
        and c.product_id = v_product_id
      limit 1;
  end;


  if v_conversation_id is null then
    raise exception 'Could not create conversation.';
  end if;

  return v_conversation_id;
end;
$$;


revoke all
on function public.buyer_open_order_conversation(uuid)
from public;

grant execute
on function public.buyer_open_order_conversation(uuid)
to authenticated;