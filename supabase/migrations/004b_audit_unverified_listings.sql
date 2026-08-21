-- ============================================================
-- Run this in Supabase SQL Editor AFTER applying migration 004.
-- It finds any product that was published by a seller who is NOT
-- currently approved, these are listings that could only have been
-- created through the vulnerability that migration 004 fixes (or a
-- seller who was approved and later got rejected/revoked).
-- ============================================================

-- Step 1: just look, don't change anything yet
select
  p.id as product_id,
  p.title,
  p.status,
  p.created_at,
  s.business_name,
  s.verification_status
from public.products p
join public.sellers s on s.id = p.seller_id
where s.verification_status != 'approved';

-- Step 2: if the query above returns any rows, hide them from public
-- view until you've reviewed the seller. Uncomment and run this next:

-- update public.products
-- set status = 'hidden'
-- where seller_id in (
--   select id from public.sellers where verification_status != 'approved'
-- );
