-- ============================================================
-- MIGRATION 005: generalized seller payment methods
-- Replaces the hardcoded "Wave" assumption with a general system where a
-- seller can add a bank account and/or mobile money account (Wave is just
-- one possible provider now, not a special case). Cash on delivery stays
-- a universal checkout option, nothing to configure for it.
-- Run this in Supabase SQL Editor if you already ran an older schema.sql.
-- ============================================================

do $$ begin
  create type payment_method_type as enum ('bank', 'mobile_money');
exception
  when duplicate_object then null;
end $$;

-- Rename the old 'wave' enum value to the more general 'digital'.
-- Safe to run even if it was already renamed.
do $$ begin
  alter type payment_method rename value 'wave' to 'digital';
exception
  when others then null;
end $$;

create table if not exists public.seller_payment_methods (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  method_type payment_method_type not null,
  provider_name text not null,
  account_name text not null,
  account_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists seller_payment_method_id uuid
  references public.seller_payment_methods(id);

alter table public.seller_payment_methods enable row level security;

drop policy if exists "seller_payment_methods_select" on public.seller_payment_methods;
create policy "seller_payment_methods_select" on public.seller_payment_methods
  for select using (
    (
      is_active = true
      and exists (
        select 1 from public.sellers s
        where s.id = seller_id and s.verification_status = 'approved'
      )
    )
    or seller_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "seller_payment_methods_insert_own" on public.seller_payment_methods;
create policy "seller_payment_methods_insert_own" on public.seller_payment_methods
  for insert with check (seller_id = auth.uid());

drop policy if exists "seller_payment_methods_update_own_or_admin" on public.seller_payment_methods;
create policy "seller_payment_methods_update_own_or_admin" on public.seller_payment_methods
  for update using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "seller_payment_methods_delete_own_or_admin" on public.seller_payment_methods;
create policy "seller_payment_methods_delete_own_or_admin" on public.seller_payment_methods
  for delete using (seller_id = auth.uid() or public.is_admin());
