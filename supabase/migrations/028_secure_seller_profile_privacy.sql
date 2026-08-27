-- ============================================================
-- MIGRATION 028
-- SECURE SELLER PROFILE PRIVACY
-- ============================================================

drop policy if exists
  sellers_select_approved_or_own_or_admin
on public.sellers;


create policy sellers_select_own_or_admin
on public.sellers
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);