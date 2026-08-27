-- ============================================================
-- MIGRATION 031
-- SECURE NOTIFICATION CREATION
-- ============================================================

drop policy if exists
  notifications_insert_system
on public.notifications;

create policy notifications_insert_admin_only
on public.notifications
for insert
to authenticated
with check (
  public.current_user_is_admin()
);