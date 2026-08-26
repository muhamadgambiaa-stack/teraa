-- 011_notification_triggers.sql
-- Automatic Teraa notifications

-- =========================================================
-- 1. NEW ORDER + ORDER STATUS CHANGES
-- =========================================================

create or replace function public.notify_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- New order -> seller
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
      '/seller/dashboard/orders'
    );

    return new;
  end if;

  -- Buyer notification when order status changes
  if new.status is distinct from old.status then

    if new.status::text = 'confirmed' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.buyer_id,
        'order',
        'Order confirmed',
        'The seller confirmed your order.',
        '/orders/' || new.id
      );

    elsif new.status::text = 'shipped' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.buyer_id,
        'order',
        'Order shipped',
        'Your order has been marked as shipped.',
        '/orders/' || new.id
      );

    elsif new.status::text = 'delivered' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.buyer_id,
        'order',
        'Order delivered',
        'The seller marked your order as delivered.',
        '/orders/' || new.id
      );

    elsif new.status::text = 'completed' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'order',
        'Order completed',
        'The buyer confirmed receiving the order.',
        '/seller/dashboard/orders'
      );

    elsif new.status::text = 'cancelled' then

      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.buyer_id,
        'order',
        'Order cancelled',
        'This order has been cancelled.',
        '/orders/' || new.id
      );

      insert into public.notifications (
        user_id, type, title, message, link
      )
      select
        new.seller_id,
        'order',
        'Order cancelled',
        'An order has been cancelled.',
        '/seller/dashboard/orders'
      where new.seller_id <> new.buyer_id;

    end if;

  end if;

  -- Payment status changes
  if new.payment_status is distinct from old.payment_status then

    if new.payment_status::text = 'submitted' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'payment',
        'Buyer submitted payment',
        'A buyer says payment has been sent. Verify the payment before confirming.',
        '/seller/dashboard/orders'
      );

    elsif new.payment_status::text = 'paid' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.buyer_id,
        'payment',
        'Payment confirmed',
        'The seller confirmed your payment.',
        '/orders/' || new.id
      );

    elsif new.payment_status::text = 'failed' then
      insert into public.notifications (
        user_id, type, title, message, link
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

drop trigger if exists orders_notifications_trigger
on public.orders;

create trigger orders_notifications_trigger
after insert or update
on public.orders
for each row
execute function public.notify_order_changes();


-- =========================================================
-- 2. SELLER VERIFICATION / ACCOUNT MODERATION
-- =========================================================

create or replace function public.notify_seller_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- Verification status changed
  if new.verification_status is distinct from old.verification_status then

    if new.verification_status::text = 'approved' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Seller verification approved',
        'Your seller account has been approved. You can now sell on Teraa.',
        '/seller/dashboard'
      );

    elsif new.verification_status::text = 'rejected' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Verification not approved',
        coalesce(
          new.verification_request_reason,
          'Your seller verification was not approved.'
        ),
        '/seller/dashboard'
      );

    end if;

  end if;

  -- Additional verification requested
  if new.verification_request_reason is distinct from old.verification_request_reason
     and new.verification_request_reason is not null
     and length(trim(new.verification_request_reason)) > 0 then

    insert into public.notifications (
      user_id, type, title, message, link
    )
    values (
      new.id,
      'verification',
      'Additional verification required',
      new.verification_request_reason,
      '/seller/dashboard/verify'
    );

  end if;

  -- Seller account moderation
  if new.account_status is distinct from old.account_status then

    if new.account_status::text = 'suspended' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'moderation',
        'Seller account suspended',
        coalesce(
          new.admin_note,
          'Your seller account has been suspended.'
        ),
        '/seller/dashboard'
      );

    elsif new.account_status::text = 'banned' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'moderation',
        'Seller account banned',
        coalesce(
          new.admin_note,
          'Your seller account has been banned.'
        ),
        '/seller/dashboard'
      );

    elsif new.account_status::text = 'active'
      and old.account_status::text in ('suspended', 'banned') then

      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Seller account restored',
        'Your seller account is active again.',
        '/seller/dashboard'
      );

    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists sellers_notifications_trigger
on public.sellers;

create trigger sellers_notifications_trigger
after update
on public.sellers
for each row
execute function public.notify_seller_changes();


-- =========================================================
-- 3. LISTING MODERATION
-- =========================================================

create or replace function public.notify_product_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if new.status is distinct from old.status then

    if new.status::text = 'admin_hidden' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'moderation',
        'Listing removed by Teraa',
        coalesce(
          new.moderation_reason,
          'One of your listings was removed after moderation.'
        ),
        '/seller/dashboard/products/' || new.id
      );

    elsif old.status::text = 'admin_hidden'
      and new.status::text in ('active', 'out_of_stock') then

      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'moderation',
        'Listing restored',
        'Your listing has been restored on Teraa.',
        '/seller/dashboard/products/' || new.id
      );

    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists product_moderation_notifications_trigger
on public.products;

create trigger product_moderation_notifications_trigger
after update
on public.products
for each row
execute function public.notify_product_moderation();


-- =========================================================
-- 4. LISTING APPEALS
-- =========================================================

create or replace function public.notify_listing_appeals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- Seller submits appeal -> notify admins
  if tg_op = 'INSERT' then

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    select
      u.id,
      'appeal',
      'New listing appeal',
      'A seller requested a review of a moderated listing.',
      '/admin/appeals/' || new.id
    from public.users u
    where u.role::text = 'admin';

    return new;
  end if;

  -- Admin decides appeal -> seller
  if new.status is distinct from old.status then

    if new.status::text = 'approved' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'appeal',
        'Listing appeal approved',
        coalesce(
          new.admin_response,
          'Your listing appeal was approved.'
        ),
        '/seller/dashboard/products/' || new.product_id
      );

    elsif new.status::text = 'rejected' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.seller_id,
        'appeal',
        'Listing appeal rejected',
        coalesce(
          new.admin_response,
          'Your listing will remain removed.'
        ),
        '/seller/dashboard/products/' || new.product_id
      );

    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists listing_appeals_notifications_trigger
on public.listing_appeals;

create trigger listing_appeals_notifications_trigger
after insert or update
on public.listing_appeals
for each row
execute function public.notify_listing_appeals();


-- =========================================================
-- 5. NEW MESSAGE -> RECIPIENT NOTIFICATION
-- =========================================================

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  sender_name text;
begin

  select
    case
      when c.buyer_id = new.sender_id
        then c.seller_id
      else c.buyer_id
    end
  into recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  select full_name
  into sender_name
  from public.users
  where id = new.sender_id;

  if recipient_id is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      recipient_id,
      'message',
      coalesce(sender_name, 'Someone') || ' sent you a message',
      left(new.content, 160),
      '/messages/' || new.conversation_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists messages_notifications_trigger
on public.messages;

create trigger messages_notifications_trigger
after insert
on public.messages
for each row
execute function public.notify_new_message();