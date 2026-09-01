-- ============================================================
-- Teraa
-- Secure seller payment method visibility
--
-- Teraa V1 is cash-on-delivery only.
-- Seller payment credentials must not be publicly readable.
-- Only the owning seller and admins may read them.
-- ============================================================

drop policy if exists
  seller_payment_methods_select
on public.seller_payment_methods;


create policy
  seller_payment_methods_select_own_or_admin
on public.seller_payment_methods
for select
to authenticated
using (
  seller_id = auth.uid()
  or public.is_admin()
);