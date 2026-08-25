-- 007_admin_listing_moderation.sql
--
-- Separates seller-hidden listings from listings removed by Teraa admins.
--
-- hidden       = seller voluntarily hid the listing
-- admin_hidden = Teraa removed the listing for moderation reasons
--
-- Sellers may edit an admin-hidden listing to correct the problem,
-- but they cannot reactivate it or erase the moderation information.

alter type public.product_status
add value if not exists 'admin_hidden';

alter table public.products
add column if not exists moderation_reason text;

alter table public.products
add column if not exists moderated_at timestamptz;

alter table public.products
add column if not exists moderated_by uuid references public.users(id)
on delete set null;


-- ---------------------------------------------------------
-- ADMIN CHECK
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- PROTECT ADMIN MODERATION
-- ---------------------------------------------------------
--
-- Even if a seller tries to bypass the Teraa UI and directly
-- update Supabase, they cannot change admin_hidden back to active
-- or erase the moderation reason.
--
-- Sellers MAY still edit title/description/price/etc. so they can
-- correct whatever caused the moderation action.

create or replace function public.protect_admin_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if old.status = 'admin_hidden'
     and not public.current_user_is_admin() then

    if new.status is distinct from old.status
       or new.moderation_reason is distinct from old.moderation_reason
       or new.moderated_at is distinct from old.moderated_at
       or new.moderated_by is distinct from old.moderated_by then

      raise exception
        'This listing was removed by Teraa and can only be restored by an administrator.';

    end if;

  end if;

  return new;
end;
$$;


drop trigger if exists protect_admin_moderation_trigger
on public.products;

create trigger protect_admin_moderation_trigger
before update on public.products
for each row
execute function public.protect_admin_moderation();