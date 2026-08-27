-- ============================================================
-- 020_direct_admin_verification_notifications.sql
--
-- Makes seller verification notifications open the exact
-- seller who submitted or resubmitted verification documents.
--
-- Instead of:
-- /admin/sellers
--
-- Notifications now use:
-- /admin/sellers/{seller_id}
-- ============================================================


-- ============================================================
-- ADMIN VERIFICATION NOTIFICATION HELPER
-- ============================================================

create or replace function public.notify_admins_verification_submission(
  p_seller_id uuid,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_name text;
begin

  /*
   * Get a useful seller name for the notification.
   *
   * Prefer business name.
   * Fall back to the user's full name.
   * Finally fall back to "A seller".
   */
  select
    coalesce(
      nullif(trim(s.business_name), ''),
      nullif(trim(u.full_name), ''),
      'A seller'
    )
  into v_seller_name
  from public.sellers s
  left join public.users u
    on u.id = s.id
  where s.id = p_seller_id;


  /*
   * Create one notification for every Teraa admin.
   *
   * Most importantly, the notification link contains
   * the exact seller ID.
   */
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link
  )
  select
    u.id,

    'verification',

    p_title,

    case
      when v_seller_name is not null then
        v_seller_name || ': ' || p_message
      else
        p_message
    end,

    '/admin/sellers/' || p_seller_id::text

  from public.users u
  where u.role::text = 'admin';

end;
$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function public.notify_admins_verification_submission(
  uuid,
  text,
  text
)
from public;


/*
 * This helper should not be called directly by marketplace
 * users. It is called internally by the secure verification
 * submission function.
 */