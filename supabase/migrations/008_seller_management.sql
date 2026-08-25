-- 008_seller_management.sql
--
-- Adds permanent seller-account moderation.
--
-- verification_status:
--   pending / approved / rejected
--
-- account_status:
--   active / suspended / banned
--
-- These are deliberately separate:
-- a seller can be identity-verified but later suspended for misconduct.

alter table public.sellers
add column if not exists account_status text
not null default 'active';

alter table public.sellers
drop constraint if exists sellers_account_status_check;

alter table public.sellers
add constraint sellers_account_status_check
check (
  account_status in (
    'active',
    'suspended',
    'banned'
  )
);

alter table public.sellers
add column if not exists admin_note text;

alter table public.sellers
add column if not exists verification_request_reason text;

alter table public.sellers
add column if not exists status_updated_at timestamptz;

alter table public.sellers
add column if not exists status_updated_by uuid
references public.users(id)
on delete set null;


-- ---------------------------------------------------------
-- PREVENT BLOCKED SELLERS FROM REACTIVATING PRODUCTS
-- ---------------------------------------------------------

create or replace function public.protect_seller_listing_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification_status text;
  v_account_status text;
begin

  -- Admin moderation operations are allowed.
  if public.current_user_is_admin() then
    return new;
  end if;

  -- Only enforce when a listing is being created/changed to ACTIVE.
  if new.status = 'active'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
     ) then

    select
      verification_status::text,
      account_status
    into
      v_verification_status,
      v_account_status
    from public.sellers
    where id = new.seller_id;

    if v_verification_status is distinct from 'approved' then
      raise exception
        'Seller verification is required before publishing listings.';
    end if;

    if v_account_status is distinct from 'active' then
      raise exception
        'This seller account is not allowed to publish listings.';
    end if;

  end if;

  return new;
end;
$$;


drop trigger if exists protect_seller_listing_activation_trigger
on public.products;

create trigger protect_seller_listing_activation_trigger
before insert or update on public.products
for each row
execute function public.protect_seller_listing_activation();