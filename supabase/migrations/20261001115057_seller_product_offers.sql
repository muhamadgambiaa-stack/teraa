create table if not exists public.product_offers (
  product_id uuid primary key references public.products(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  kind text not null check (kind in ('discount', 'voucher')),
  percent_off integer not null check (percent_off between 1 and 90),
  voucher_code text,
  expires_at timestamptz not null,
  check ((kind = 'discount' and voucher_code is null) or
    (kind = 'voucher' and voucher_code is not null and voucher_code ~ '^[A-Z0-9]{3,20}$'))
);
create index if not exists product_offers_seller_id_idx on public.product_offers(seller_id);
create index if not exists product_offers_expires_at_idx on public.product_offers(expires_at);
alter table public.product_offers enable row level security;
grant select on public.product_offers to anon, authenticated;
grant insert, update, delete on public.product_offers to authenticated;

-- Seller account status is private; expose only this boolean to RLS.
create or replace function private.offer_seller_is_active(p_seller_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sellers s join public.users u on u.id=s.id
    where s.id=p_seller_id and s.verification_status::text='approved'
      and s.account_status='active' and u.account_status='active');
$$;
revoke all on function private.offer_seller_is_active(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.offer_seller_is_active(uuid) to anon, authenticated;

create policy product_offers_public_read on public.product_offers for select to anon, authenticated
using (expires_at > now() and private.offer_seller_is_active(seller_id) and exists
  (select 1 from public.products p where p.id=product_id and p.seller_id=product_offers.seller_id
    and p.status::text='active' and p.stock_quantity > 0 and p.seller_deleted_at is null));
create policy product_offers_owner_read on public.product_offers for select to authenticated
using (seller_id=(select auth.uid()));
create policy product_offers_owner_insert on public.product_offers for insert to authenticated
with check (seller_id=(select auth.uid()) and private.offer_seller_is_active(seller_id));
create policy product_offers_owner_update on public.product_offers for update to authenticated
using (seller_id=(select auth.uid()))
with check (seller_id=(select auth.uid()) and private.offer_seller_is_active(seller_id));
create policy product_offers_owner_delete on public.product_offers for delete to authenticated
using (seller_id=(select auth.uid()));

-- Validate ownership without taking a listing lock (checkout locks the offer row).
create or replace function private.validate_product_offer()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_product public.products%rowtype;
begin
  if tg_op='DELETE' then
    return old;
  end if;
  select * into v_product from public.products where id=new.product_id;
  if not found or v_product.seller_id is distinct from new.seller_id then
    raise exception 'Offer must belong to the listing seller';
  end if;
  if tg_op='UPDATE' and (old.product_id is distinct from new.product_id or old.seller_id is distinct from new.seller_id) then
    raise exception 'Offer ownership cannot change';
  end if;
  if v_product.status::text <> 'active' or v_product.seller_deleted_at is not null or v_product.stock_quantity < 1 or v_product.price <= 0 then
    raise exception 'Choose an active, in-stock product with a price above zero';
  end if;
  if new.expires_at <= now() or new.expires_at > now()+interval '90 days 1 minute' then
    raise exception 'Offer must end within 90 days';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_product_offer() from public;
create trigger validate_product_offer before insert or update or delete on public.product_offers
for each row execute function private.validate_product_offer();

alter table public.order_items add column if not exists original_unit_price numeric(12,2),
  add column if not exists offer_percent_off integer,
  add column if not exists voucher_code text;
create or replace function public.create_marketplace_order_v3(
  p_product_id uuid,
  p_quantity integer,
  p_delivery_region text,
  p_delivery_town text,
  p_delivery_address text,
  p_delivery_phone text,
  p_delivery_landmark text default null,
  p_delivery_notes text default null,
  p_selected_size text default null,
  p_selected_color text default null,
  p_voucher_code text default null,
  p_expected_unit_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_product public.products%rowtype;
  v_seller public.sellers%rowtype;
  v_buyer_status text;
  v_seller_user_status text;
  v_order_id uuid;
  v_remaining_stock integer;
  v_region text;
  v_town text;
  v_address text;
  v_phone text;
  v_landmark text;
  v_notes text;
  v_selected_size text;
  v_selected_color text;
  v_offer public.product_offers%rowtype;
  v_unit_price numeric(12,2);
  v_percent integer;
  v_code text;
begin
  v_buyer_id := auth.uid();

  if v_buyer_id is null then
    raise exception 'Authentication required';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;

  v_region := trim(coalesce(p_delivery_region, ''));
  v_town := trim(coalesce(p_delivery_town, ''));
  v_address := trim(coalesce(p_delivery_address, ''));
  v_phone := trim(coalesce(p_delivery_phone, ''));
  v_landmark := nullif(trim(coalesce(p_delivery_landmark, '')), '');
  v_notes := nullif(trim(coalesce(p_delivery_notes, '')), '');
  v_selected_size := nullif(trim(coalesce(p_selected_size, '')), '');
  v_selected_color := nullif(trim(coalesce(p_selected_color, '')), '');

  if v_region = '' then
    raise exception 'Delivery region is required';
  end if;

  if v_region <> all(array[
    'Banjul',
    'Kanifing',
    'Brikama',
    'Mansakonko',
    'Kerewan',
    'Kuntaur',
    'Janjanbureh',
    'Basse'
  ]::text[]) then
    raise exception 'Invalid delivery region';
  end if;

  if char_length(v_town) not between 2 and 100 then
    raise exception 'Enter a valid delivery town or area';
  end if;

  if char_length(v_address) not between 5 and 300 then
    raise exception 'Enter a complete delivery address';
  end if;

  if char_length(v_phone) not between 7 and 30 then
    raise exception 'Enter a valid delivery phone number';
  end if;

  if v_landmark is not null and char_length(v_landmark) > 200 then
    raise exception 'Delivery landmark is too long';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Delivery notes are too long';
  end if;

  if v_selected_size is not null and char_length(v_selected_size) > 40 then
    raise exception 'Invalid product size';
  end if;

  if v_selected_color is not null and char_length(v_selected_color) > 40 then
    raise exception 'Invalid product colour';
  end if;

  select account_status
  into v_buyer_status
  from public.users
  where id = v_buyer_id;

  if v_buyer_status is null then
    raise exception 'Buyer account not found';
  end if;

  if v_buyer_status <> 'active' then
    raise exception 'Buyer account is not active';
  end if;

  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_product.seller_id = v_buyer_id then
    raise exception 'You cannot buy your own product';
  end if;

  if v_product.status::text <> 'active' then
    raise exception 'Product is not available';
  end if;

  if v_product.stock_quantity < p_quantity then
    raise exception 'Not enough stock';
  end if;

  if cardinality(v_product.available_sizes) > 0 then
    if v_selected_size is null
      or not (v_selected_size = any(v_product.available_sizes)) then
      raise exception 'Choose an available product size';
    end if;
  elsif v_selected_size is not null then
    raise exception 'This product does not have size choices';
  end if;

  if cardinality(v_product.available_colors) > 0 then
    if v_selected_color is null
      or not (v_selected_color = any(v_product.available_colors)) then
      raise exception 'Choose an available product colour';
    end if;
  elsif v_selected_color is not null then
    raise exception 'This product does not have colour choices';
  end if;

  select *
  into v_seller
  from public.sellers
  where id = v_product.seller_id;

  if not found then
    raise exception 'Seller not found';
  end if;

  if v_seller.verification_status::text <> 'approved' then
    raise exception 'Seller is not verified';
  end if;

  if v_seller.account_status <> 'active' then
    raise exception 'Seller is unavailable';
  end if;

  if cardinality(v_seller.delivery_regions) = 0 then
    raise exception 'Seller has not configured delivery regions';
  end if;

  if not (v_region = any(v_seller.delivery_regions)) then
    raise exception 'Seller does not deliver to this region';
  end if;

  select account_status
  into v_seller_user_status
  from public.users
  where id = v_product.seller_id;

  if v_seller_user_status is distinct from 'active' then
    raise exception 'Seller is unavailable';
  end if;

  -- Compute the authoritative unit price while the listing is locked.
  v_code := nullif(upper(trim(coalesce(p_voucher_code, ''))), '');
  select * into v_offer from public.product_offers
    where product_id=v_product.id and seller_id=v_product.seller_id
      and expires_at > now() for share;
  v_unit_price := v_product.price;
  if v_code is not null and (v_offer.kind is distinct from 'voucher' or v_offer.voucher_code is distinct from v_code) then
    raise exception 'Voucher is invalid or expired';
  end if;
  if v_offer.kind='discount' or (v_offer.kind='voucher' and v_code=v_offer.voucher_code) then
    v_percent := v_offer.percent_off;
    v_unit_price := round(v_product.price * (100-v_percent)/100, 2);
  end if;
  if p_expected_unit_price is not null and p_expected_unit_price is distinct from v_unit_price then
    raise exception 'Offer price changed. Review your order again';
  end if;

  insert into public.orders (
    buyer_id,
    seller_id,
    payment_method,
    seller_payment_method_id,
    payment_status,
    delivery_city,
    delivery_region,
    delivery_town,
    delivery_address,
    delivery_phone,
    delivery_landmark,
    delivery_notes
  )
  values (
    v_buyer_id,
    v_product.seller_id,
    'cod'::public.payment_method,
    null,
    'pending'::public.payment_status,
    v_town,
    v_region,
    v_town,
    v_address,
    v_phone,
    v_landmark,
    v_notes
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    price_at_purchase,
    selected_size,
    selected_color,
    original_unit_price,
    offer_percent_off,
    voucher_code
  )
  values (
    v_order_id,
    v_product.id,
    p_quantity,
    v_unit_price,
    v_selected_size,
    v_selected_color,
    v_product.price,
    v_percent,
    v_code
  );

  v_remaining_stock := v_product.stock_quantity - p_quantity;

  update public.products
  set
    stock_quantity = v_remaining_stock,
    status = case
      when v_remaining_stock <= 0
        then 'out_of_stock'::public.product_status
      else 'active'::public.product_status
    end
  where id = v_product.id;

  return v_order_id;
end;
$$;

revoke all on function public.create_marketplace_order_v3(uuid, integer, text, text, text, text, text, text, text, text, text, numeric) from public;
grant execute on function public.create_marketplace_order_v3(uuid, integer, text, text, text, text, text, text, text, text, text, numeric) to authenticated, service_role;

-- Older clients also receive automatic discounts; stock and delivery safeguards
-- remain in v3. Both RPCs check auth.uid() and seller/buyer status internally.
create or replace function public.create_marketplace_order_v2(
  p_product_id uuid, p_quantity integer, p_delivery_region text, p_delivery_town text,
  p_delivery_address text, p_delivery_phone text, p_delivery_landmark text default null,
  p_delivery_notes text default null, p_selected_size text default null, p_selected_color text default null
) returns uuid language sql security invoker set search_path = '' as $$
  select public.create_marketplace_order_v3(p_product_id, p_quantity, p_delivery_region,
    p_delivery_town, p_delivery_address, p_delivery_phone, p_delivery_landmark,
    p_delivery_notes, p_selected_size, p_selected_color, null, null);
$$;
revoke all on function public.create_marketplace_order_v2(uuid, integer, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_marketplace_order_v2(uuid, integer, text, text, text, text, text, text, text, text) to authenticated, service_role;
notify pgrst, 'reload schema';

-- Price filters and sorting use the same automatic discount as checkout.
create or replace view public.marketplace_priced_products with (security_invoker=true) as
select p.*, case when o.kind='discount' then round(p.price*(100-o.percent_off)/100,2) else p.price end as effective_price
from public.products p left join public.product_offers o on o.product_id=p.id and o.seller_id=p.seller_id
  and o.expires_at > now() and private.offer_seller_is_active(o.seller_id);
grant select on public.marketplace_priced_products to anon, authenticated;
notify pgrst, 'reload schema';
