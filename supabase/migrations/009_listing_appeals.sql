-- 009_listing_appeals.sql
--
-- Allows sellers to request a re-review of listings
-- that were removed by Teraa admins.
--
-- Appeal statuses:
-- pending  = waiting for admin review
-- approved = admin restored the listing
-- rejected = admin decided to keep it removed


-- ---------------------------------------------------------
-- APPEAL STATUS TYPE
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'listing_appeal_status'
  ) then
    create type public.listing_appeal_status as enum (
      'pending',
      'approved',
      'rejected'
    );
  end if;
end $$;


-- ---------------------------------------------------------
-- LISTING APPEALS TABLE
-- ---------------------------------------------------------

create table if not exists public.listing_appeals (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  seller_id uuid not null
    references public.sellers(id)
    on delete cascade,

  message text not null,

  status public.listing_appeal_status
    not null
    default 'pending',

  admin_response text,

  created_at timestamptz
    not null
    default now(),

  reviewed_at timestamptz,

  reviewed_by uuid
    references public.users(id)
    on delete set null
);


-- ---------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------

create index if not exists listing_appeals_product_id_idx
on public.listing_appeals(product_id);

create index if not exists listing_appeals_seller_id_idx
on public.listing_appeals(seller_id);

create index if not exists listing_appeals_status_idx
on public.listing_appeals(status);

create index if not exists listing_appeals_created_at_idx
on public.listing_appeals(created_at desc);


-- ---------------------------------------------------------
-- ONLY ONE PENDING APPEAL PER PRODUCT
-- ---------------------------------------------------------

create unique index if not exists listing_appeals_one_pending_per_product_idx
on public.listing_appeals(product_id)
where status = 'pending';


-- ---------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------

alter table public.listing_appeals
enable row level security;


-- ---------------------------------------------------------
-- SELLER: READ OWN APPEALS
-- ---------------------------------------------------------

drop policy if exists
"listing_appeals_select_own"
on public.listing_appeals;

create policy
"listing_appeals_select_own"
on public.listing_appeals
for select
to authenticated
using (
  seller_id = auth.uid()
  or public.current_user_is_admin()
);


-- ---------------------------------------------------------
-- SELLER: CREATE APPEAL
-- ---------------------------------------------------------
--
-- Seller may only appeal:
-- - their own product
-- - when product is admin_hidden
-- - when their seller account is not banned
--
-- Admin does not need this insert policy.

drop policy if exists
"listing_appeals_insert_own"
on public.listing_appeals;

create policy
"listing_appeals_insert_own"
on public.listing_appeals
for insert
to authenticated
with check (
  seller_id = auth.uid()

  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.seller_id = auth.uid()
      and p.status = 'admin_hidden'
  )

  and exists (
    select 1
    from public.sellers s
    where s.id = auth.uid()
      and s.account_status <> 'banned'
  )
);


-- ---------------------------------------------------------
-- ADMIN: UPDATE APPEALS
-- ---------------------------------------------------------

drop policy if exists
"listing_appeals_admin_update"
on public.listing_appeals;

create policy
"listing_appeals_admin_update"
on public.listing_appeals
for update
to authenticated
using (
  public.current_user_is_admin()
)
with check (
  public.current_user_is_admin()
);


-- ---------------------------------------------------------
-- ADMIN: DELETE APPEALS
-- ---------------------------------------------------------
--
-- Normally you should keep history.
-- This exists only for emergency/admin cleanup.

drop policy if exists
"listing_appeals_admin_delete"
on public.listing_appeals;

create policy
"listing_appeals_admin_delete"
on public.listing_appeals
for delete
to authenticated
using (
  public.current_user_is_admin()
);