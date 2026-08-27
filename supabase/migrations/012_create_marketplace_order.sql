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
  v_order_id uuid;
  v_remaining_stock integer;
begin
  v_buyer_id := auth.uid();

  if v_buyer_id is null then
    raise exception 'Authentication required';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;

  if p_delivery_city is null or trim(p_delivery_city) = '' then
    raise exception 'Delivery city is required';
  end if;

  /*
   * Buyer must exist and be active.
   */
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

  /*
   * Lock product row while creating the order.
   *
   * This prevents two buyers from consuming
   * the same remaining stock at the same time.
   */
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

  if v_product.status <> 'active' then
    raise exception 'Product is not available';
  end if;

  if v_product.stock_quantity < p_quantity then
    raise exception 'Not enough stock';
  end if;

  /*
   * Seller must exist, be active and verified.
   */
  select *
  into v_seller
  from public.sellers
  where id = v_product.seller_id;

  if not found then
    raise exception 'Seller not found';
  end if;

  if v_seller.verification_status <> 'approved' then
    raise exception 'Seller is not verified';
  end if;

  if v_seller.account_status <> 'active' then
    raise exception 'Seller is unavailable';
  end if;

  /*
   * Validate chosen payment method.
   */
  if p_payment_method = 'digital' then
    if p_seller_payment_method_id is null then
      raise exception 'Payment method is required';
    end if;

    if not exists (
      select 1
      from public.seller_payment_methods spm
      where spm.id = p_seller_payment_method_id
        and spm.seller_id = v_product.seller_id
        and spm.is_active = true
    ) then
      raise exception 'Invalid seller payment method';
    end if;

  elsif p_payment_method <> 'cod' then
    raise exception 'Invalid payment method';
  end if;

  /*
   * Create order.
   */
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
    p_payment_method::payment_method,
    case
      when p_payment_method = 'digital'
        then p_seller_payment_method_id
      else null
    end,
    'pending',
    trim(p_delivery_city),
    nullif(trim(coalesce(p_delivery_notes, '')), '')
  )
  returning id into v_order_id;

  /*
   * Save product snapshot for the order.
   */
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

  /*
   * Reduce stock.
   */
  v_remaining_stock :=
    v_product.stock_quantity - p_quantity;

  update public.products
  set
    stock_quantity = v_remaining_stock,
    status = case
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