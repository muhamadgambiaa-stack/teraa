-- Deleted listings must remain unavailable even if their status is changed
-- through an administrative or historical workflow.

drop policy if exists "products_select_active_or_own_or_admin"
on public.products;

create policy "products_select_active_or_own_or_admin"
on public.products
for select
using (
  (
    status = 'active'::public.product_status
    and seller_deleted_at is null
  )
  or seller_id = (select auth.uid())
  or (select public.is_admin())
);
