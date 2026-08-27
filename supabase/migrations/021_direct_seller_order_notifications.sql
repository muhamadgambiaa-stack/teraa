-- ============================================================
-- 021_direct_seller_order_notifications.sql
--
-- Makes seller order notifications open the exact order
-- instead of the general seller orders page.
--
-- Seller order links now use:
--
-- /seller/dashboard/orders/{order_id}
-- ============================================================

create or replace function public.notify_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ==========================================================
  -- NEW ORDER -> SELLER
  -- ==========================================================

  if tg_op = 'INSERT' then

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      new.seller_id,
      'order',
      'New order',
      'You received a new order on Teraa.',
      '/seller/dashboard/orders/' || new.id
    );

    return new;

  end if;


  -- ==========================================================
  -- ORDER STATUS CHANGES
  -- ==========================================================

  if new.status is distinct from old.status then

    -- --------------------------------------------------------
    -- CONFIRMED -> BUYER
    -- --------------------------------------------------------

    if new.status::text = 'confirmed' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'order',
        'Order confirmed',
        'The seller confirmed your order.',
        '/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- SHIPPED -> BUYER
    -- --------------------------------------------------------

    elsif new.status::text = 'shipped' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'order',
        'Order shipped',
        'Your order has been marked as shipped.',
        '/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- DELIVERED -> BUYER
    -- --------------------------------------------------------

    elsif new.status::text = 'delivered' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'order',
        'Order delivered',
        'The seller marked your order as delivered.',
        '/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- COMPLETED -> SELLER
    -- --------------------------------------------------------

    elsif new.status::text = 'completed' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.seller_id,
        'order',
        'Order completed',
        'The buyer confirmed receiving the order.',
        '/seller/dashboard/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- CANCELLED -> BUYER + SELLER
    -- --------------------------------------------------------

    elsif new.status::text = 'cancelled' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'order',
        'Order cancelled',
        'This order has been cancelled.',
        '/orders/' || new.id
      );


      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      select
        new.seller_id,
        'order',
        'Order cancelled',
        'An order has been cancelled.',
        '/seller/dashboard/orders/' || new.id
      where new.seller_id <> new.buyer_id;

    end if;

  end if;


  -- ==========================================================
  -- PAYMENT STATUS CHANGES
  -- ==========================================================
  --
  -- These branches remain for legacy/future digital-payment
  -- support. Teraa checkout is currently COD-only.
  -- ==========================================================

  if new.payment_status is distinct from old.payment_status then

    -- --------------------------------------------------------
    -- PAYMENT SUBMITTED -> SELLER
    -- --------------------------------------------------------

    if new.payment_status::text = 'submitted' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.seller_id,
        'payment',
        'Buyer submitted payment',
        'A buyer says payment has been sent. Verify the payment before confirming.',
        '/seller/dashboard/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- PAYMENT CONFIRMED -> BUYER
    -- --------------------------------------------------------

    elsif new.payment_status::text = 'paid' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'payment',
        'Payment confirmed',
        'The seller confirmed your payment.',
        '/orders/' || new.id
      );


    -- --------------------------------------------------------
    -- PAYMENT FAILED -> BUYER
    -- --------------------------------------------------------

    elsif new.payment_status::text = 'failed' then

      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        link
      )
      values (
        new.buyer_id,
        'payment',
        'Payment issue',
        'There is a problem with the payment for this order.',
        '/orders/' || new.id
      );

    end if;

  end if;


  return new;

end;
$$;