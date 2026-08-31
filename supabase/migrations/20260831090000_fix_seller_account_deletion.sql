create or replace function public.delete_my_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if btrim(coalesce(p_confirmation, '')) <> 'delete my account' then
    raise exception 'confirmation_mismatch' using errcode = '22023';
  end if;

  delete from public.messages
  where sender_id = v_user_id;

  delete from public.conversations
  where buyer_id = v_user_id
     or seller_id = v_user_id;

  /*
   * Deleting reviews recalculates seller ratings. During self-deletion the
   * rating guard would otherwise mistake that internal trigger update for a
   * seller manually changing their own rating. Temporarily clear the request
   * user while the review triggers run, then restore it immediately.
   */
  perform set_config('request.jwt.claim.sub', '', true);

  delete from public.reviews
  where buyer_id = v_user_id
     or seller_id = v_user_id
     or order_id in (
       select id from public.orders
       where buyer_id = v_user_id or seller_id = v_user_id
     );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  delete from public.order_delivery_issues
  where buyer_id = v_user_id
     or seller_id = v_user_id
     or order_id in (
       select id from public.orders
       where buyer_id = v_user_id or seller_id = v_user_id
     );

  delete from public.reports
  where reporter_id = v_user_id;

  delete from public.orders
  where buyer_id = v_user_id
     or seller_id = v_user_id;

  delete from public.products
  where seller_id = v_user_id;

  delete from public.seller_payment_methods
  where seller_id = v_user_id;

  delete from public.sellers
  where id = v_user_id;

  update public.users
  set restricted_by = null
  where restricted_by = v_user_id;

  delete from public.users
  where id = v_user_id;

  delete from auth.users
  where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated, service_role;
