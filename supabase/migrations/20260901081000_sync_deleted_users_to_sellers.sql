-- Keep the marketplace seller record consistent when an Auth account is
-- removed directly or through Teraa's account-deletion workflow.
create or replace function private.mark_profile_deleted_after_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set
    full_name = 'Deleted user',
    phone_number = 'deleted-' || replace(old.id::text, '-', ''),
    city = null,
    profile_photo_url = null,
    is_verified = false,
    account_status = 'deleted',
    restriction_reason = null,
    restricted_at = null,
    restricted_by = null,
    deleted_at = coalesce(deleted_at, now())
  where id = old.id;

  update public.sellers
  set
    business_name = 'Deleted seller',
    id_document_url = null,
    wave_number = null,
    shop_description = null,
    shop_banner_url = null,
    account_status = 'deleted',
    admin_note = null,
    verification_request_reason = null,
    status_updated_at = now(),
    status_updated_by = null,
    legal_name = null,
    document_sha256 = null,
    identity_document_type = null,
    identity_document_number = null,
    delivery_regions = '{}'::text[]
  where id = old.id;

  update public.products
  set status = 'hidden'::public.product_status,
      description = null
  where seller_id = old.id;

  return old;
end;
$$;

revoke all on function private.mark_profile_deleted_after_auth_user()
from public, anon, authenticated;

-- Repair sellers whose linked user is already deleted.
update public.sellers as seller
set
  business_name = 'Deleted seller',
  id_document_url = null,
  wave_number = null,
  shop_description = null,
  shop_banner_url = null,
  account_status = 'deleted',
  admin_note = null,
  verification_request_reason = null,
  status_updated_at = coalesce(seller.status_updated_at, now()),
  status_updated_by = null,
  legal_name = null,
  document_sha256 = null,
  identity_document_type = null,
  identity_document_number = null,
  delivery_regions = '{}'::text[]
from public.users as profile
where profile.id = seller.id
  and profile.account_status = 'deleted'
  and seller.account_status <> 'deleted';

update public.products as product
set status = 'hidden'::public.product_status,
    description = null
from public.users as profile
where profile.id = product.seller_id
  and profile.account_status = 'deleted'
  and product.status::text <> 'hidden';

create or replace function public.prevent_deleted_seller_reactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.users u
    where u.id = new.id
      and u.account_status = 'deleted'
  ) and new.account_status <> 'deleted' then
    raise exception 'deleted_seller_cannot_be_reactivated';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_deleted_seller_reactivation()
from public, anon, authenticated;

drop trigger if exists prevent_deleted_seller_reactivation
on public.sellers;

create trigger prevent_deleted_seller_reactivation
before insert or update on public.sellers
for each row
execute function public.prevent_deleted_seller_reactivation();
