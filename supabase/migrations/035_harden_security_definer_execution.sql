-- ============================================================
-- MIGRATION 035
-- HARDEN SECURITY DEFINER FUNCTION EXECUTION
-- ============================================================


-- ------------------------------------------------------------
-- 1. INTERNAL TRIGGER FUNCTIONS
-- Browser/client roles must not execute these directly.
-- Database triggers continue to work normally.
-- ------------------------------------------------------------

revoke execute on function public.notify_listing_appeals()
from public, anon, authenticated;

revoke execute on function public.notify_new_message()
from public, anon, authenticated;

revoke execute on function public.notify_order_changes()
from public, anon, authenticated;

revoke execute on function public.notify_product_moderation()
from public, anon, authenticated;

revoke execute on function public.notify_seller_changes()
from public, anon, authenticated;

revoke execute on function public.protect_admin_moderation()
from public, anon, authenticated;

revoke execute on function public.protect_message_update()
from public, anon, authenticated;

revoke execute on function public.protect_order_mutations()
from public, anon, authenticated;

revoke execute on function public.protect_report_submission()
from public, anon, authenticated;

revoke execute on function public.protect_review_identity()
from public, anon, authenticated;

revoke execute on function public.protect_seller_admin_fields()
from public, anon, authenticated;

revoke execute on function public.protect_seller_listing_activation()
from public, anon, authenticated;

revoke execute on function public.protect_seller_privileges()
from public, anon, authenticated;

revoke execute on function public.protect_seller_verification_status()
from public, anon, authenticated;

revoke execute on function public.protect_user_privileges()
from public, anon, authenticated;

revoke execute on function public.recalc_seller_rating()
from public, anon, authenticated;


-- ------------------------------------------------------------
-- 2. AUTHENTICATED-ONLY RPCs
-- These functions perform real user actions.
-- Anonymous clients do not need EXECUTE permission.
-- ------------------------------------------------------------

revoke execute
on function public.create_marketplace_order(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.create_marketplace_order(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
)
to authenticated;


revoke execute
on function public.cancel_order(uuid)
from public, anon;

grant execute
on function public.cancel_order(uuid)
to authenticated;


revoke execute
on function public.marketplace_seller_is_available(uuid)
from public, anon;

grant execute
on function public.marketplace_seller_is_available(uuid)
to authenticated;


revoke execute
on function public.resubmit_seller_verification(text)
from public, anon;

grant execute
on function public.resubmit_seller_verification(text)
to authenticated;