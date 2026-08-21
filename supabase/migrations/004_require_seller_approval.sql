-- ============================================================
-- MIGRATION 004: require seller approval before they can list products
-- Without this, a seller with verification_status = 'pending' or
-- 'rejected' could still insert an active product row (RLS only checked
-- seller_id = auth.uid(), not their approval state), and that listing
-- would be publicly visible immediately since the SELECT policy only
-- checks status = 'active'. Run this if you ran schema.sql before this
-- fix existed.
-- ============================================================

drop policy if exists "products_insert_own_seller" on public.products;
create policy "products_insert_own_seller" on public.products
  for insert with check (
    seller_id = auth.uid()
    and exists (
      select 1 from public.sellers s
      where s.id = auth.uid() and s.verification_status = 'approved'
    )
  );
