create or replace function public.protect_seller_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resubmission_user text;
  v_is_resubmission boolean := false;
begin

  /*
   * Requests made without an authenticated Supabase user
   * are database/service operations and are not blocked here.
   */
  if auth.uid() is null then
    return new;
  end if;

  /*
   * Teraa administrators may perform moderation changes.
   */
  if public.current_user_is_admin() then
    return new;
  end if;

  /*
   * The secure resubmit_seller_verification() RPC sets this
   * transaction-local value before changing:
   *
   * rejected -> pending
   *
   * and clearing the old verification request reason.
   */
  v_resubmission_user :=
    current_setting(
      'app.verification_resubmission',
      true
    );

  v_is_resubmission :=
    old.verification_status::text = 'rejected'
    and new.verification_status::text = 'pending'
    and new.id = auth.uid()
    and v_resubmission_user = auth.uid()::text;

  /*
   * VERIFICATION STATUS
   *
   * Sellers may never approve themselves.
   * The only seller-controlled exception is the secure
   * rejected -> pending resubmission flow.
   */
  if new.verification_status
       is distinct from old.verification_status
     and not v_is_resubmission then

    raise exception
      'You cannot change your own verification status.';

  end if;

  /*
   * SELLER ACCOUNT STATUS
   *
   * active / suspended / banned remain admin-only.
   */
  if new.account_status
       is distinct from old.account_status then

    raise exception
      'You cannot change your own seller account status.';

  end if;

  /*
   * VERIFICATION REQUEST REASON
   *
   * The resubmission RPC may clear the old rejection/request
   * reason when the seller submits a corrected document.
   *
   * Sellers cannot otherwise create, edit or remove it.
   */
  if new.verification_request_reason
       is distinct from old.verification_request_reason then

    if not (
      v_is_resubmission
      and new.verification_request_reason is null
    ) then

      raise exception
        'You cannot change verification requirements.';

    end if;

  end if;

  /*
   * ADMIN NOTES
   */
  if new.admin_note
       is distinct from old.admin_note then

    raise exception
      'You cannot change administrator notes.';

  end if;

  return new;
end;
$$;