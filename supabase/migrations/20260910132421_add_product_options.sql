-- Optional product choices shown to buyers at checkout.
alter table public.products
  add column if not exists available_sizes text[] not null default '{}'::text[],
  add column if not exists available_colors text[] not null default '{}'::text[];

alter table public.products
  drop constraint if exists products_available_sizes_limit,
  add constraint products_available_sizes_limit
    check (
      cardinality(available_sizes) <= 30
      and array_position(available_sizes, null) is null
    ),
  drop constraint if exists products_available_colors_limit,
  add constraint products_available_colors_limit
    check (
      cardinality(available_colors) <= 30
      and array_position(available_colors, null) is null
    );

-- Keep the buyer's choices as an order snapshot even if the seller later
-- changes the listing.
alter table public.order_items
  add column if not exists selected_size text,
  add column if not exists selected_color text;

alter table public.order_items
  drop constraint if exists order_items_selected_size_length,
  add constraint order_items_selected_size_length
    check (selected_size is null or char_length(selected_size) between 1 and 40),
  drop constraint if exists order_items_selected_color_length,
  add constraint order_items_selected_color_length
    check (selected_color is null or char_length(selected_color) between 1 and 40);

-- Replace the existing signature so PostgREST has one unambiguous RPC.
-- The new arguments have defaults, which keeps older deployed clients working
-- while the application deployment rolls out.
drop function if exists public.create_marketplace_order_v2(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
);

create function public.create_marketplace_order_v2(
  p_product_id uuid,
  p_quantity integer,
  p_delivery_region text,
  p_delivery_town text,
  p_delivery_address text,
  p_delivery_phone text,
  p_delivery_landmark text default null,
  p_delivery_notes text default null,
  p_selected_size text default null,
  p_selected_color text default null
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
    selected_color
  )
  values (
    v_order_id,
    v_product.id,
    p_quantity,
    v_product.price,
    v_selected_size,
    v_selected_color
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

revoke all on function public.create_marketplace_order_v2(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_marketplace_order_v2(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated, service_role;
