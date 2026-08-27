-- ============================================================
-- 019_verification_submission_notifications.sql
--
-- Notifies Teraa admins whenever a seller submits or
-- resubmits verification documents.
--
-- Covers:
-- 1. First verification submission
-- 2. Rejected seller resubmission
-- 3. Additional-document resubmission
-- ============================================================


-- ============================================================
-- 1. NOTIFICATION HELPER
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
begin

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
    p_message,
    '/admin/sellers'
  from public.users u
  where u.role::text = 'admin';

end;
$$;


revoke all
on function public.notify_admins_verification_submission(
  uuid,
  text,
  text
)
from public;


-- ============================================================
-- 2. UPDATE RESUBMISSION RPC
-- ============================================================

create or replace function public.resubmit_seller_verification(
  p_document_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_seller public.sellers%rowtype;
  v_was_rejected boolean;
  v_had_additional_request boolean;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;


  if p_document_path is null
     or trim(p_document_path) = '' then

    raise exception
      'Verification document is required';

  end if;


  if split_part(
       trim(p_document_path),
       '/',
       1
     ) <> v_user_id::text then

    raise exception
      'Invalid verification document path';

  end if;


  select *
  into v_seller
  from public.sellers
  where id = v_user_id
  for update;


  if not found then
    raise exception
      'Seller account not found';
  end if;


  if v_seller.account_status = 'banned' then
    raise exception
      'Banned seller accounts cannot submit verification';
  end if;


  if v_seller.verification_status::text = 'approved' then
    raise exception
      'This seller account is already verified';
  end if;


  if v_seller.verification_status::text
     not in ('pending', 'rejected') then

    raise exception
      'Verification cannot be submitted from the current status';

  end if;


  v_was_rejected :=
    v_seller.verification_status::text = 'rejected';


  v_had_additional_request :=
    v_seller.verification_request_reason is not null
    and length(
      trim(
        v_seller.verification_request_reason
      )
    ) > 0;


  perform set_config(
    'app.verification_resubmission',
    v_user_id::text,
    true
  );


  update public.sellers
  set
    id_document_url =
      trim(p_document_path),

    verification_status =
      'pending'::verification_status,

    verification_request_reason =
      null

  where id = v_user_id;


  -- ----------------------------------------------------------
  -- ADMIN NOTIFICATION
  -- ----------------------------------------------------------

  if v_was_rejected then

    perform public.notify_admins_verification_submission(
      v_user_id,
      'Seller resubmitted verification',
      'A seller has uploaded a new verification document after rejection.'
    );

  elsif v_had_additional_request then

    perform public.notify_admins_verification_submission(
      v_user_id,
      'Additional document submitted',
      'A seller has responded to an additional verification document request.'
    );

  else

    perform public.notify_admins_verification_submission(
      v_user_id,
      'Verification submitted',
      'A seller has submitted verification documents for review.'
    );

  end if;

end;
$$;


revoke all
on function public.resubmit_seller_verification(text)
from public;


grant execute
on function public.resubmit_seller_verification(text)
to authenticated;