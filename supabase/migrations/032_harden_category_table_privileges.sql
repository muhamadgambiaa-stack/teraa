-- ============================================================
-- MIGRATION 032
-- HARDEN CATEGORY TABLE PRIVILEGES
-- ============================================================

revoke truncate
on table public.categories
from anon, authenticated;