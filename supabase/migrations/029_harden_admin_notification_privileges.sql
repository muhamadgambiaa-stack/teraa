-- ============================================================
-- MIGRATION 029
-- HARDEN ADMIN NOTIFICATION + TABLE PRIVILEGES
-- ============================================================

revoke execute
on function public.notify_admins_verification_submission(uuid, text, text)
from public;

revoke execute
on function public.notify_admins_verification_submission(uuid, text, text)
from anon;

revoke execute
on function public.notify_admins_verification_submission(uuid, text, text)
from authenticated;


revoke truncate
on table public.listing_appeals
from anon, authenticated;

revoke truncate
on table public.notifications
from anon, authenticated;

revoke truncate
on table public.reports
from anon, authenticated;