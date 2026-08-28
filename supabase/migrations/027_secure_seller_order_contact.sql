-- ============================================================
-- TERAA
-- Secure seller access to buyer order contact information
-- and seller-initiated messaging for genuine orders.
-- ============================================================


-- ============================================================
-- 1. GET BUYER CONTACT FOR SELLER ORDER
-- ============================================================
--
-- This function does NOT make the users table public.
--
-- It only returns limited buyer information when:
--
--   - the caller is authenticated
--   - the caller owns the order as seller
--   - the seller account is approved
--   - the seller account is active
--   - the seller's main user account is active
--
-- This lets a seller fulfill a genuine order while keeping
-- unrelated users' private profiles protected.
-- ============================================================

create or replace function public.get_order_buyer_for_seller(
  p_order_id uuid
)
returns table (
  id uuid,
  full_name text,
  phone_number text,
  city text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    buyer.id,
    buyer.full_name::text,
    buyer.phone_number::text,
    buyer.city::text
  from public.orders o
  join public.users buyer
    on buyer.id = o.buyer_id
  join public.sellers seller
    on seller.id = o.seller_id
  join public.users seller_user
    on seller_user.id = seller.id
  where o.id = p_order_id
    and o.seller_id = auth.uid()
    and seller.verification_status::text = 'approved'
    and seller.account_status = 'active'
    and seller_user.account_status = 'active'
  limit 1;
$$;

revoke all
on function public.get_order_buyer_for_seller(uuid)
from public;

grant execute
on function public.get_order_buyer_for_seller(uuid)
to authenticated;


-- ============================================================
-- 2. SELLER OPENS ORDER CONVERSATION
-- ============================================================
--
-- Existing messaging RLS intentionally allows buyers to
-- initiate ordinary marketplace conversations.
--
-- Sellers should not be able to randomly create conversations
-- with arbitrary buyers.
--
-- This SECURITY DEFINER function creates/reuses a conversation
-- only when there is a genuine order owned by the seller.
-- ============================================================

create or replace function public.seller_open_order_conversation(
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


  -- ----------------------------------------------------------
  -- Verify that this is a real order owned by this seller.
  -- Also require the seller and marketplace account to remain
  -- active and approved.
  -- ----------------------------------------------------------

  select
    o.buyer_id,
    o.seller_id
  into
    v_buyer_id,
    v_seller_id
  from public.orders o
  join public.sellers s
    on s.id = o.seller_id
  join public.users u
    on u.id = s.id
  where o.id = p_order_id
    and o.seller_id = v_user_id
    and s.verification_status::text = 'approved'
    and s.account_status = 'active'
    and u.account_status = 'active'
  limit 1;

  if v_buyer_id is null or v_seller_id is null then
    raise exception 'Order not found or seller is not authorized.';
  end if;


  -- ----------------------------------------------------------
  -- Teraa V1 currently creates an order from one listing.
  --
  -- Get the product attached to the genuine order.
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Reuse an existing marketplace conversation.
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Create the conversation.
  --
  -- The function itself has already verified the order
  -- relationship, so we do not need to weaken the normal
  -- conversations INSERT RLS policy.
  -- ----------------------------------------------------------

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

      -- Another request may have created the same conversation
      -- at nearly the same moment.

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
on function public.seller_open_order_conversation(uuid)
from public;

grant execute
on function public.seller_open_order_conversation(uuid)
to authenticated;