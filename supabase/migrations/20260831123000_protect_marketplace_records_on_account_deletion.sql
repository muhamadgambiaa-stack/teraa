alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add column if not exists deleted_at timestamptz;

alter table public.users
  drop constraint if exists users_account_status_check;

alter table public.users
  add constraint users_account_status_check
  check (account_status = any (array[
    'active'::text,
    'restricted'::text,
    'suspended'::text,
    'banned'::text,
    'deleted'::text
  ]));

alter table public.sellers
  drop constraint if exists sellers_account_status_check;

alter table public.sellers
  add constraint sellers_account_status_check
  check (account_status = any (array[
    'active'::text,
    'suspended'::text,
    'banned'::text,
    'deleted'::text
  ]));

create or replace function public.delete_my_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if btrim(coalesce(p_confirmation, '')) <> 'delete my account' then
    raise exception 'confirmation_mismatch' using errcode = '22023';
  end if;

  select role
  into v_role
  from public.users
  where id = v_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  if v_role = 'admin'::public.user_role then
    raise exception 'admin_deletion_not_allowed' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.orders
    where (buyer_id = v_user_id or seller_id = v_user_id)
      and status not in (
        'completed'::public.order_status,
        'cancelled'::public.order_status
      )
  ) then
    raise exception 'active_orders_exist' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.order_delivery_issues
    where (buyer_id = v_user_id or seller_id = v_user_id)
      and status <> 'resolved'
  ) then
    raise exception 'unresolved_delivery_issue_exists' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.commissions
    where seller_id = v_user_id
      and status not in ('paid', 'waived')
  ) then
    raise exception 'unpaid_commission_exists' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.reports
    where status <> 'resolved'::public.report_status
      and (
        target_id = v_user_id
        or target_id in (
          select id from public.products where seller_id = v_user_id
        )
      )
  ) then
    raise exception 'unresolved_report_exists' using errcode = 'P0001';
  end if;

  delete from public.messages
  where sender_id = v_user_id;

  delete from public.conversations
  where buyer_id = v_user_id
     or seller_id = v_user_id;

  perform set_config('request.jwt.claim.sub', '', true);

  delete from public.reviews
  where buyer_id = v_user_id
     or seller_id = v_user_id;

  delete from public.support_threads
  where user_id = v_user_id;

  delete from public.cart_items
  where buyer_id = v_user_id
     or product_id in (
       select id from public.products where seller_id = v_user_id
     );

  delete from public.favorites
  where buyer_id = v_user_id
     or product_id in (
       select id from public.products where seller_id = v_user_id
     );

  delete from public.notifications
  where user_id = v_user_id;

  delete from public.push_subscriptions
  where user_id = v_user_id;

  update public.orders
  set seller_payment_method_id = null,
      delivery_address = null,
      delivery_phone = null,
      delivery_landmark = null,
      delivery_notes = null,
      delivery_handler = null,
      delivery_contact_name = null,
      delivery_contact_phone = null,
      delivery_tracking_reference = null
  where buyer_id = v_user_id
     or seller_id = v_user_id;

  delete from public.product_photos
  where product_id in (
    select id from public.products where seller_id = v_user_id
  );

  update public.products
  set status = 'hidden'::public.product_status,
      description = null
  where seller_id = v_user_id;

  delete from public.commission_listing_holds
  where seller_id = v_user_id;

  delete from public.seller_delivery_areas
  where seller_id = v_user_id;

  delete from public.seller_payment_methods
  where seller_id = v_user_id;

  update public.sellers
  set business_name = 'Deleted seller',
      id_document_url = null,
      wave_number = null,
      shop_description = null,
      shop_banner_url = null,
      account_status = 'deleted',
      admin_note = null,
      verification_request_reason = null,
      status_updated_at = null,
      status_updated_by = null,
      legal_name = null,
      document_sha256 = null,
      identity_document_type = null,
      identity_document_number = null,
      delivery_regions = '{}'::text[]
  where id = v_user_id;

  update public.users
  set phone_number = 'deleted-' || replace(v_user_id::text, '-', ''),
      full_name = 'Deleted user',
      city = null,
      profile_photo_url = null,
      is_verified = false,
      account_status = 'deleted',
      restriction_reason = null,
      restricted_at = null,
      restricted_by = null,
      deleted_at = now()
  where id = v_user_id;

  update public.users
  set restricted_by = null
  where restricted_by = v_user_id;

  delete from auth.users
  where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text)
to authenticated, service_role;
