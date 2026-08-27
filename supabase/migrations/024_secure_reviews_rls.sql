-- ============================================================
-- 024_secure_reviews_rls.sql
-- TERAA REVIEW SECURITY
--
-- Buyers may:
--   - review only their own completed order
--   - review only the actual seller/product from that order
--   - update only their own legitimate review
--
-- Review identity remains protected by the existing
-- protect_review_identity() trigger.
-- ============================================================

alter table public.reviews enable row level security;


-- ------------------------------------------------------------
-- Remove the old overlapping review policies
-- ------------------------------------------------------------

drop policy if exists "reviews_insert_own"
on public.reviews;

drop policy if exists "reviews_insert_own_buyer"
on public.reviews;

drop policy if exists "reviews_update_own_buyer"
on public.reviews;

drop policy if exists "reviews_select_all"
on public.reviews;


-- ------------------------------------------------------------
-- PUBLIC READ
--
-- Reviews are marketplace-public information.
-- ------------------------------------------------------------

create policy "reviews_public_read"
on public.reviews
for select
to public
using (true);


-- ------------------------------------------------------------
-- INSERT
--
-- A buyer may create a review only when:
--
-- 1. buyer_id is themselves
-- 2. the referenced order belongs to them
-- 3. the order is completed
-- 4. seller_id matches the order seller
-- 5. product_id actually exists in that exact order
-- ------------------------------------------------------------

create policy "reviews_buyer_insert"
on public.reviews
for insert
to authenticated
with check (
  buyer_id = auth.uid()

  and public.current_user_is_active()

  and exists (
    select 1
    from public.orders o
    where o.id = reviews.order_id
      and o.buyer_id = auth.uid()
      and o.seller_id = reviews.seller_id
      and o.status::text = 'completed'
  )

  and exists (
    select 1
    from public.order_items oi
    where oi.order_id = reviews.order_id
      and oi.product_id = reviews.product_id
  )
);


-- ------------------------------------------------------------
-- UPDATE
--
-- The buyer must own the review AND the review must continue
-- to point to their completed order, correct seller and
-- actual product.
--
-- protect_review_identity() remains responsible for preventing
-- buyer_id/order_id/seller_id/product_id from being changed.
-- ------------------------------------------------------------

create policy "reviews_buyer_update"
on public.reviews
for update
to authenticated
using (
  buyer_id = auth.uid()
  and public.current_user_is_active()
)
with check (
  buyer_id = auth.uid()

  and public.current_user_is_active()

  and exists (
    select 1
    from public.orders o
    where o.id = reviews.order_id
      and o.buyer_id = auth.uid()
      and o.seller_id = reviews.seller_id
      and o.status::text = 'completed'
  )

  and exists (
    select 1
    from public.order_items oi
    where oi.order_id = reviews.order_id
      and oi.product_id = reviews.product_id
  )
);