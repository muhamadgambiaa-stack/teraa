-- ============================================================
-- 018_additional_verification_resubmission.sql
--
-- Supports both seller verification resubmission cases:
--
-- 1. rejected -> pending
-- 2. pending + additional document requested -> pending
--
-- Sellers still cannot:
-- - approve themselves
-- - change account status
-- - create/edit admin verification requirements
-- - edit admin notes
-- ============================================================


-- ============================================================
-- 1. SECURE VERIFICATION RESUBMISSION RPC
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


  /*
   * Document must be inside this seller's own
   * private storage folder.
   */
  if split_part(
       trim(p_document_path),
       '/',
       1
     ) <> v_user_id::text then

    raise exception
      'Invalid verification document path';

  end if;


  /*
   * Lock seller while processing resubmission.
   */
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


  /*
   * Only pending and rejected sellers may use
   * this self-service verification workflow.
   */
  if v_seller.verification_status::text
     not in ('pending', 'rejected') then

    raise exception
      'Verification cannot be submitted from the current status';

  end if;


  /*
   * Mark this transaction as an authorized
   * verification submission.
   *
   * The protection triggers below verify this
   * exact authenticated seller.
   */
  perform set_config(
    'app.verification_resubmission',
    v_user_id::text,
    true
  );


  /*
   * Valid outcomes:
   *
   * rejected -> pending
   *
   * pending + additional document requested
   * -> remains pending
   *
   * The old admin request is cleared because
   * the seller has now responded with a new document.
   */
  update public.sellers
  set
    id_document_url =
      trim(p_document_path),

    verification_status =
      'pending'::verification_status,

    verification_request_reason =
      null

  where id = v_user_id;

end;
$$;


revoke all
on function public.resubmit_seller_verification(text)
from public;


grant execute
on function public.resubmit_seller_verification(text)
to authenticated;


-- ============================================================
-- 2. PROTECT VERIFICATION STATUS
-- ============================================================
--
-- Normal sellers still cannot change verification_status.
--
-- Only the controlled RPC may perform:
--
-- rejected -> pending
-- ============================================================

create or replace function public.protect_seller_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resubmission_user text;
begin

  if auth.uid() is null then
    return new;
  end if;


  if public.current_user_is_admin() then
    return new;
  end if;


  /*
   * No verification-status change.
   *
   * This covers additional-document resubmissions
   * where status remains pending.
   */
  if new.verification_status
       is not distinct from old.verification_status then

    return new;

  end if;


  v_resubmission_user :=
    current_setting(
      'app.verification_resubmission',
      true
    );


  /*
   * Only safe seller-controlled status transition.
   */
  if old.verification_status::text = 'rejected'
     and new.verification_status::text = 'pending'
     and new.id = auth.uid()
     and v_resubmission_user = auth.uid()::text then

    return new;

  end if;


  raise exception
    'You cannot change your own verification status.';

end;
$$;


-- ============================================================
-- 3. PROTECT ADMIN-ONLY SELLER FIELDS
-- ============================================================

create or replace function public.protect_seller_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resubmission_user text;

  v_controlled_resubmission boolean := false;

  v_rejected_to_pending boolean := false;
begin

  /*
   * Database/service operations.
   */
  if auth.uid() is null then
    return new;
  end if;


  /*
   * Teraa admins may perform moderation operations.
   */
  if public.current_user_is_admin() then
    return new;
  end if;


  v_resubmission_user :=
    current_setting(
      'app.verification_resubmission',
      true
    );


  /*
   * The secure RPC marks the current transaction.
   *
   * It supports:
   *
   * pending -> pending
   *
   * rejected -> pending
   */
  v_controlled_resubmission :=
    new.id = auth.uid()

    and v_resubmission_user =
      auth.uid()::text

    and old.verification_status::text
      in ('pending', 'rejected')

    and new.verification_status::text =
      'pending';


  v_rejected_to_pending :=
    v_controlled_resubmission

    and old.verification_status::text =
      'rejected'

    and new.verification_status::text =
      'pending';


  -- ----------------------------------------------------------
  -- VERIFICATION STATUS
  -- ----------------------------------------------------------

  if new.verification_status
       is distinct from old.verification_status then

    if not v_rejected_to_pending then

      raise exception
        'You cannot change your own verification status.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- SELLER ACCOUNT STATUS
  -- ----------------------------------------------------------

  if new.account_status
       is distinct from old.account_status then

    raise exception
      'You cannot change your own seller account status.';

  end if;


  -- ----------------------------------------------------------
  -- VERIFICATION REQUEST
  -- ----------------------------------------------------------
  --
  -- Admin may create the request.
  --
  -- Seller may ONLY clear it when responding through
  -- the secure verification-resubmission RPC.
  -- ----------------------------------------------------------

  if new.verification_request_reason
       is distinct from old.verification_request_reason then

    if not (
      v_controlled_resubmission
      and new.verification_request_reason is null
    ) then

      raise exception
        'You cannot change verification requirements.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- ADMIN NOTE
  -- ----------------------------------------------------------

  if new.admin_note
       is distinct from old.admin_note then

    raise exception
      'You cannot change administrator notes.';

  end if;


  return new;

end;
$$;