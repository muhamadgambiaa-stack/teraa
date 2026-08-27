-- ============================================================
-- 013_security_hardening.sql
--
-- Security hardening for Teraa.
--
-- This migration:
--
-- 1. Prevents users from making themselves admins.
-- 2. Protects account moderation fields.
-- 3. Protects seller verification and moderation fields.
-- 4. Prevents sellers from forging admin moderation metadata.
-- 5. Forces listing appeals to begin as pending.
-- 6. Hardens product reviews.
-- 7. Makes marketplace checkout COD-only at database level.
-- 8. Prevents direct order/order-item creation outside the secure RPC.
-- 9. Restricts order status changes to valid marketplace transitions.
-- 10. Makes cancellation/restocking safer.
-- 11. Fixes public seller-profile verification rules.
-- 12. Fixes member_since for buyers.
--
-- Run once after migrations 007 through 012.
-- ============================================================


-- ============================================================
-- 1. ADMIN HELPER
-- ============================================================

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;


-- Keep older policies/functions that use is_admin() working.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin();
$$;


-- ============================================================
-- 2. PROTECT USER ACCOUNT PRIVILEGES
-- ============================================================
--
-- RLS controls rows, not individual columns.
--
-- A normal user may edit their own name, phone, city and
-- profile information, but must NEVER be able to change:
--
-- role
-- account_status
-- is_verified
-- id
-- created_at
--
-- This trigger also prevents a newly registered user from
-- inserting their own users row with role = admin.
-- ============================================================

create or replace function public.protect_user_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- Database maintenance / service operations.
  if auth.uid() is null then
    return new;
  end if;

  -- Existing Teraa admins may perform administrative changes.
  if public.current_user_is_admin() then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- NEW USER
  -- ----------------------------------------------------------

  if tg_op = 'INSERT' then

    if new.id <> auth.uid() then
      raise exception
        'You cannot create an account for another user.';
    end if;

    if new.role::text not in ('buyer', 'seller') then
      raise exception
        'Invalid public account role.';
    end if;

    if new.is_verified is distinct from false then
      raise exception
        'Verification status cannot be set by the user.';
    end if;

    /*
     * account_status exists in the current Teraa database.
     * New public accounts must begin active.
     */
    if new.account_status is distinct from 'active' then
      raise exception
        'Invalid initial account status.';
    end if;

    return new;
  end if;


  -- ----------------------------------------------------------
  -- EXISTING USER
  -- ----------------------------------------------------------

  if new.id is distinct from old.id then
    raise exception
      'Account ID cannot be changed.';
  end if;

  if new.role is distinct from old.role then
    raise exception
      'Account role can only be changed by a Teraa administrator.';
  end if;

  if new.is_verified is distinct from old.is_verified then
    raise exception
      'Verification status can only be changed by Teraa.';
  end if;

  if new.account_status is distinct from old.account_status then
    raise exception
      'Account status can only be changed by a Teraa administrator.';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception
      'Account creation date cannot be changed.';
  end if;

  return new;
end;
$$;


drop trigger if exists protect_user_privileges_trigger
on public.users;

create trigger protect_user_privileges_trigger
before insert or update
on public.users
for each row
execute function public.protect_user_privileges();


-- ============================================================
-- 3. PROTECT SELLER PRIVILEGES
-- ============================================================
--
-- Sellers may manage normal shop information such as:
--
-- business_name
-- id_document_url
-- wave_number
-- shop_description
-- shop_banner_url
--
-- They may NOT directly control:
--
-- verification approval
-- suspension / ban status
-- admin notes
-- ratings
-- sales counters
-- moderation metadata
--
-- A rejected seller may safely move back to PENDING when
-- resubmitting verification. They can never self-approve.
-- ============================================================

create or replace function public.protect_seller_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- SELLER INSERT
  -- ----------------------------------------------------------

  if tg_op = 'INSERT' then

    if new.id <> auth.uid() then
      raise exception
        'You cannot create a seller account for another user.';
    end if;

    if new.verification_status::text <> 'pending' then
      raise exception
        'New seller accounts must begin with pending verification.';
    end if;

    if new.account_status <> 'active' then
      raise exception
        'New seller accounts must begin active.';
    end if;

    if coalesce(new.rating_avg, 0) <> 0 then
      raise exception
        'Seller rating cannot be set manually.';
    end if;

    if coalesce(new.total_sales, 0) <> 0 then
      raise exception
        'Seller sales count cannot be set manually.';
    end if;

    if new.admin_note is not null then
      raise exception
        'Admin notes cannot be created by sellers.';
    end if;

    if new.verification_request_reason is not null then
      raise exception
        'Verification requests are controlled by Teraa.';
    end if;

    if new.status_updated_at is not null then
      raise exception
        'Seller moderation timestamps are controlled by Teraa.';
    end if;

    if new.status_updated_by is not null then
      raise exception
        'Seller moderation information is controlled by Teraa.';
    end if;

    return new;
  end if;


  -- ----------------------------------------------------------
  -- SELLER UPDATE
  -- ----------------------------------------------------------

  if new.id is distinct from old.id then
    raise exception
      'Seller account ID cannot be changed.';
  end if;


  /*
   * Allow rejected sellers to resubmit verification.
   *
   * They may go:
   *
   * rejected -> pending
   *
   * but NEVER:
   *
   * pending -> approved
   * rejected -> approved
   */
  if new.verification_status is distinct from old.verification_status then

    if not (
      old.verification_status::text = 'rejected'
      and new.verification_status::text = 'pending'
    ) then
      raise exception
        'Seller verification status can only be changed by Teraa.';
    end if;

  end if;


  if new.account_status is distinct from old.account_status then
    raise exception
      'Seller account status can only be changed by Teraa.';
  end if;


  if new.admin_note is distinct from old.admin_note then
    raise exception
      'Admin notes can only be changed by Teraa.';
  end if;


  /*
   * A seller may clear an old verification request when
   * resubmitting, but may not create or rewrite one.
   */
  if new.verification_request_reason
       is distinct from old.verification_request_reason then

    if not (
      new.verification_request_reason is null
      and new.verification_status::text = 'pending'
    ) then
      raise exception
        'Verification request information can only be changed by Teraa.';
    end if;

  end if;


  if new.status_updated_at is distinct from old.status_updated_at then
    raise exception
      'Seller moderation timestamps can only be changed by Teraa.';
  end if;


  if new.status_updated_by is distinct from old.status_updated_by then
    raise exception
      'Seller moderation information can only be changed by Teraa.';
  end if;


  if new.rating_avg is distinct from old.rating_avg then
    raise exception
      'Seller rating is calculated automatically.';
  end if;


  if new.total_sales is distinct from old.total_sales then
    raise exception
      'Seller sales count is controlled by Teraa.';
  end if;


  if new.created_at is distinct from old.created_at then
    raise exception
      'Seller creation date cannot be changed.';
  end if;


  return new;
end;
$$;


drop trigger if exists protect_seller_privileges_trigger
on public.sellers;

create trigger protect_seller_privileges_trigger
before insert or update
on public.sellers
for each row
execute function public.protect_seller_privileges();


-- ============================================================
-- 4. HARDEN ADMIN LISTING MODERATION
-- ============================================================
--
-- Sellers must not be able to:
--
-- mark their own product admin_hidden
-- forge moderation reasons
-- forge moderated_by
-- erase moderation metadata
-- restore an admin-hidden product
--
-- Sellers may still edit normal listing fields while the
-- product remains admin_hidden so they can correct the listing
-- and submit an appeal.
-- ============================================================

create or replace function public.protect_admin_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;


  -- Seller cannot create an admin moderation state.
  if old.status::text <> 'admin_hidden'
     and new.status::text = 'admin_hidden' then

    raise exception
      'Only a Teraa administrator can remove a listing for moderation.';

  end if;


  -- Moderation metadata is always admin-controlled.
  if new.moderation_reason
       is distinct from old.moderation_reason
     or new.moderated_at
       is distinct from old.moderated_at
     or new.moderated_by
       is distinct from old.moderated_by then

    raise exception
      'Listing moderation information can only be changed by Teraa.';

  end if;


  -- Once admin-hidden, seller cannot change listing status.
  if old.status::text = 'admin_hidden'
     and new.status is distinct from old.status then

    raise exception
      'This listing was removed by Teraa and can only be restored by an administrator.';

  end if;


  return new;
end;
$$;


drop trigger if exists protect_admin_moderation_trigger
on public.products;

create trigger protect_admin_moderation_trigger
before update
on public.products
for each row
execute function public.protect_admin_moderation();


-- ============================================================
-- 5. KEEP SELLER LISTING ACTIVATION PROTECTION
-- ============================================================

create or replace function public.protect_seller_listing_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification_status text;
  v_seller_account_status text;
  v_user_account_status text;
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;


  if new.status::text = 'active'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
     ) then

    select
      s.verification_status::text,
      s.account_status,
      u.account_status
    into
      v_verification_status,
      v_seller_account_status,
      v_user_account_status
    from public.sellers s
    join public.users u
      on u.id = s.id
    where s.id = new.seller_id;


    if v_verification_status is distinct from 'approved' then
      raise exception
        'Seller verification is required before publishing listings.';
    end if;


    if v_seller_account_status is distinct from 'active' then
      raise exception
        'This seller account is not allowed to publish listings.';
    end if;


    if v_user_account_status is distinct from 'active' then
      raise exception
        'This user account is not allowed to publish listings.';
    end if;

  end if;


  return new;
end;
$$;


drop trigger if exists protect_seller_listing_activation_trigger
on public.products;

create trigger protect_seller_listing_activation_trigger
before insert or update
on public.products
for each row
execute function public.protect_seller_listing_activation();


-- ============================================================
-- 6. HARDEN LISTING APPEAL CREATION
-- ============================================================
--
-- Seller-created appeals MUST begin:
--
-- status = pending
-- admin_response = null
-- reviewed_at = null
-- reviewed_by = null
-- ============================================================

drop policy if exists
"listing_appeals_insert_own"
on public.listing_appeals;


create policy
"listing_appeals_insert_own"
on public.listing_appeals
for insert
to authenticated
with check (

  seller_id = auth.uid()

  and status::text = 'pending'

  and admin_response is null

  and reviewed_at is null

  and reviewed_by is null

  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.seller_id = auth.uid()
      and p.status::text = 'admin_hidden'
  )

  and exists (
    select 1
    from public.sellers s
    where s.id = auth.uid()
      and s.account_status <> 'banned'
  )

);


-- ============================================================
-- 7. HARDEN PRODUCT REVIEWS
-- ============================================================
--
-- A review must:
--
-- belong to the authenticated buyer
-- reference the buyer's completed order
-- reference the SAME seller as the order
-- reference a product actually purchased in that order
-- ============================================================

drop policy if exists
"reviews_insert_own_buyer"
on public.reviews;


create policy
"reviews_insert_own_buyer"
on public.reviews
for insert
to authenticated
with check (

  buyer_id = auth.uid()

  and exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.buyer_id = auth.uid()
      and o.seller_id = seller_id
      and o.status::text = 'completed'
  )

  and exists (
    select 1
    from public.order_items oi
    where oi.order_id = order_id
      and oi.product_id = product_id
  )

);


-- ============================================================
-- 8. PROTECT ORDER MUTATIONS
-- ============================================================
--
-- Buyers and sellers can see their order rows, but they must
-- not be able to arbitrarily edit order data through Supabase.
--
-- SELLER allowed transitions:
--
-- placed    -> confirmed
-- confirmed -> shipped
-- shipped   -> delivered
--
-- Cancellation MUST go through cancel_order().
--
-- BUYER allowed transition:
--
-- shipped / delivered -> completed
--
-- COD completion must also mark payment_status = paid.
-- ============================================================

create or replace function public.protect_order_mutations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_cancel_rpc boolean;
begin

  v_actor := auth.uid();

  if v_actor is null then
    return new;
  end if;


  if public.current_user_is_admin() then
    return new;
  end if;


  if v_actor <> old.buyer_id
     and v_actor <> old.seller_id then

    raise exception
      'You are not allowed to modify this order.';

  end if;


  -- ----------------------------------------------------------
  -- IMMUTABLE ORDER DATA
  -- ----------------------------------------------------------

  if new.id is distinct from old.id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.payment_method is distinct from old.payment_method
     or new.seller_payment_method_id
          is distinct from old.seller_payment_method_id
     or new.delivery_city is distinct from old.delivery_city
     or new.delivery_notes is distinct from old.delivery_notes
     or new.created_at is distinct from old.created_at then

    raise exception
      'Order details cannot be changed after checkout.';

  end if;


  -- ----------------------------------------------------------
  -- CANCELLATION
  -- ----------------------------------------------------------

  v_cancel_rpc :=
    coalesce(
      current_setting(
        'app.teraa_cancel_order',
        true
      ),
      ''
    ) = '1';


  if new.status::text = 'cancelled'
     and old.status is distinct from new.status then

    if not v_cancel_rpc then
      raise exception
        'Orders must be cancelled through the Teraa cancellation process.';
    end if;

    if old.status::text not in (
      'placed',
      'confirmed'
    ) then
      raise exception
        'This order can no longer be cancelled.';
    end if;

    if new.payment_status is distinct from old.payment_status then
      raise exception
        'Cancellation cannot modify payment status.';
    end if;

    return new;

  end if;


  -- ----------------------------------------------------------
  -- SELLER
  -- ----------------------------------------------------------

  if v_actor = old.seller_id then

    if new.payment_status is distinct from old.payment_status then
      raise exception
        'Sellers cannot directly modify payment status.';
    end if;


    if new.status is not distinct from old.status then
      return new;
    end if;


    if old.status::text = 'placed'
       and new.status::text = 'confirmed' then
      return new;
    end if;


    if old.status::text = 'confirmed'
       and new.status::text = 'shipped' then
      return new;
    end if;


    if old.status::text = 'shipped'
       and new.status::text = 'delivered' then
      return new;
    end if;


    raise exception
      'Invalid seller order status change.';

  end if;


  -- ----------------------------------------------------------
  -- BUYER
  -- ----------------------------------------------------------

  if v_actor = old.buyer_id then

    /*
     * Buyer completing COD order.
     */
    if old.status::text in (
         'shipped',
         'delivered'
       )
       and new.status::text = 'completed' then

      if old.payment_method::text = 'cod' then

        if new.payment_status::text <> 'paid' then
          raise exception
            'Cash-on-delivery orders must be marked paid when completed.';
        end if;

      else

        /*
         * Legacy digital orders may still exist.
         * Do not automatically modify their payment status.
         */
        if new.payment_status is distinct from old.payment_status then
          raise exception
            'Digital payment status cannot be changed during order completion.';
        end if;

      end if;

      return new;

    end if;


    /*
     * Harmless no-op.
     */
    if new.status is not distinct from old.status
       and new.payment_status is not distinct from old.payment_status then
      return new;
    end if;


    raise exception
      'Invalid buyer order status change.';

  end if;


  return new;
end;
$$;


drop trigger if exists protect_order_mutations_trigger
on public.orders;

create trigger protect_order_mutations_trigger
before update
on public.orders
for each row
execute function public.protect_order_mutations();


-- ============================================================
-- 9. REQUIRE CHECKOUT THROUGH SECURE RPC
-- ============================================================
--
-- Buyers no longer need permission to directly INSERT orders
-- or order_items because create_marketplace_order() is
-- SECURITY DEFINER and performs those operations safely.
-- ============================================================

drop policy if exists
"orders_insert_own_buyer"
on public.orders;


drop policy if exists
"order_items_insert"
on public.order_items;


-- ============================================================
-- 10. COD-ONLY SECURE CHECKOUT
-- ============================================================
--
-- Online payment is currently "Coming soon".
--
-- Even if someone bypasses the Next.js UI and calls the RPC
-- directly, the database refuses digital checkout.
-- ============================================================

create or replace function public.create_marketplace_order(
  p_product_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_seller_payment_method_id uuid,
  p_delivery_city text,
  p_delivery_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;

  v_product public.products%rowtype;

  v_seller public.sellers%rowtype;

  v_buyer_status text;

  v_seller_user_status text;

  v_order_id uuid;

  v_remaining_stock integer;
begin

  v_buyer_id := auth.uid();


  if v_buyer_id is null then
    raise exception
      'Authentication required';
  end if;


  -- ----------------------------------------------------------
  -- INPUT VALIDATION
  -- ----------------------------------------------------------

  if p_quantity is null
     or p_quantity < 1 then

    raise exception
      'Invalid quantity';

  end if;


  if p_delivery_city is null
     or trim(p_delivery_city) = '' then

    raise exception
      'Delivery city is required';

  end if;


  if length(trim(p_delivery_city)) > 100 then
    raise exception
      'Delivery city is too long';
  end if;


  if length(
       coalesce(
         p_delivery_notes,
         ''
       )
     ) > 500 then

    raise exception
      'Delivery notes are too long';

  end if;


  -- ----------------------------------------------------------
  -- COD ONLY
  -- ----------------------------------------------------------

  if p_payment_method <> 'cod' then
    raise exception
      'Only cash on delivery is currently available';
  end if;


  if p_seller_payment_method_id is not null then
    raise exception
      'Online payment methods are currently unavailable';
  end if;


  -- ----------------------------------------------------------
  -- BUYER STATUS
  -- ----------------------------------------------------------

  select account_status
  into v_buyer_status
  from public.users
  where id = v_buyer_id;


  if v_buyer_status is null then
    raise exception
      'Buyer account not found';
  end if;


  if v_buyer_status <> 'active' then
    raise exception
      'Buyer account is not active';
  end if;


  -- ----------------------------------------------------------
  -- PRODUCT
  -- ----------------------------------------------------------
  --
  -- Lock product row to prevent overselling.
  -- ----------------------------------------------------------

  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;


  if not found then
    raise exception
      'Product not found';
  end if;


  if v_product.seller_id = v_buyer_id then
    raise exception
      'You cannot buy your own product';
  end if;


  if v_product.status::text <> 'active' then
    raise exception
      'Product is not available';
  end if;


  if v_product.stock_quantity < p_quantity then
    raise exception
      'Not enough stock';
  end if;


  -- ----------------------------------------------------------
  -- SELLER
  -- ----------------------------------------------------------

  select *
  into v_seller
  from public.sellers
  where id = v_product.seller_id;


  if not found then
    raise exception
      'Seller not found';
  end if;


  if v_seller.verification_status::text <> 'approved' then
    raise exception
      'Seller is not verified';
  end if;


  if v_seller.account_status <> 'active' then
    raise exception
      'Seller is unavailable';
  end if;


  select account_status
  into v_seller_user_status
  from public.users
  where id = v_product.seller_id;


  if v_seller_user_status is distinct from 'active' then
    raise exception
      'Seller is unavailable';
  end if;


  -- ----------------------------------------------------------
  -- CREATE ORDER
  -- ----------------------------------------------------------

  insert into public.orders (
    buyer_id,
    seller_id,
    payment_method,
    seller_payment_method_id,
    payment_status,
    delivery_city,
    delivery_notes
  )
  values (
    v_buyer_id,
    v_product.seller_id,
    'cod'::payment_method,
    null,
    'pending',
    trim(p_delivery_city),
    nullif(
      trim(
        coalesce(
          p_delivery_notes,
          ''
        )
      ),
      ''
    )
  )
  returning id
  into v_order_id;


  -- ----------------------------------------------------------
  -- PURCHASE SNAPSHOT
  -- ----------------------------------------------------------

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    price_at_purchase
  )
  values (
    v_order_id,
    v_product.id,
    p_quantity,
    v_product.price
  );


  -- ----------------------------------------------------------
  -- STOCK
  -- ----------------------------------------------------------

  v_remaining_stock :=
    v_product.stock_quantity
    - p_quantity;


  update public.products
  set
    stock_quantity =
      v_remaining_stock,

    status =
      case
        when v_remaining_stock <= 0
          then 'out_of_stock'::product_status

        else 'active'::product_status
      end

  where id = v_product.id;


  return v_order_id;

end;
$$;


revoke all
on function public.create_marketplace_order(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
)
from public;


grant execute
on function public.create_marketplace_order(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
)
to authenticated;


-- ============================================================
-- 11. SAFER ORDER CANCELLATION
-- ============================================================

create or replace function public.cancel_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare

  v_order public.orders%rowtype;

  v_item record;

begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;


  if not found then
    raise exception
      'Order not found';
  end if;


  if auth.uid() <> v_order.buyer_id
     and auth.uid() <> v_order.seller_id
     and not public.current_user_is_admin() then

    raise exception
      'You are not allowed to cancel this order';

  end if;


  if v_order.status::text not in (
    'placed',
    'confirmed'
  ) then

    raise exception
      'This order can no longer be cancelled';

  end if;


  /*
   * Tell protect_order_mutations() that this update came from
   * the trusted cancellation workflow.
   */
  perform set_config(
    'app.teraa_cancel_order',
    '1',
    true
  );


  update public.orders
  set status =
    'cancelled'::order_status
  where id = p_order_id;


  -- ----------------------------------------------------------
  -- RETURN STOCK
  -- ----------------------------------------------------------

  for v_item in

    select
      product_id,
      quantity

    from public.order_items

    where order_id =
      p_order_id

  loop

    update public.products p

    set

      stock_quantity =
        p.stock_quantity
        + v_item.quantity,

      status =
        case

          /*
           * Only reactivate an automatically out-of-stock
           * listing if the seller is still allowed to sell.
           */
          when p.status::text = 'out_of_stock'

            and exists (
              select 1
              from public.sellers s
              join public.users u
                on u.id = s.id

              where s.id = p.seller_id

                and s.verification_status::text = 'approved'

                and s.account_status = 'active'

                and u.account_status = 'active'
            )

          then 'active'::product_status


          /*
           * Hidden/admin-hidden listings remain hidden.
           * Blocked sellers stay out_of_stock.
           */
          else p.status

        end

    where p.id =
      v_item.product_id;

  end loop;

end;
$$;


revoke all
on function public.cancel_order(uuid)
from public;


grant execute
on function public.cancel_order(uuid)
to authenticated;


-- ============================================================
-- 12. SAFER PUBLIC PROFILES
-- ============================================================
--
-- Seller information is public only when:
--
-- seller is APPROVED
-- seller account is ACTIVE
-- user account is ACTIVE
--
-- Buyer member_since now uses users.created_at rather than now().
-- ============================================================

create or replace function public.get_public_profile(
  p_user_id uuid
)
returns table (

  id uuid,

  full_name text,

  city text,

  profile_photo_url text,

  public_role text,

  business_name text,

  shop_description text,

  shop_banner_url text,

  verification_status text,

  rating_avg numeric,

  total_sales integer,

  member_since timestamptz

)
language sql
stable
security definer
set search_path = public
as $$

  select

    u.id,

    u.full_name,

    u.city,

    u.profile_photo_url,


    case

      when s.id is not null

        and s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then 'seller'

      else 'buyer'

    end as public_role,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.business_name

      else null

    end as business_name,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.shop_description

      else null

    end as shop_description,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.shop_banner_url

      else null

    end as shop_banner_url,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.verification_status::text

      else null

    end as verification_status,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.rating_avg

      else null

    end as rating_avg,


    case

      when s.verification_status::text = 'approved'

        and s.account_status = 'active'

        and u.account_status = 'active'

      then s.total_sales

      else null

    end as total_sales,


    coalesce(
      s.created_at,
      u.created_at
    ) as member_since


  from public.users u


  left join public.sellers s
    on s.id = u.id


  where u.id = p_user_id;

$$;


revoke all
on function public.get_public_profile(uuid)
from public;


grant execute
on function public.get_public_profile(uuid)
to anon, authenticated;


-- ============================================================
-- DONE
-- ============================================================