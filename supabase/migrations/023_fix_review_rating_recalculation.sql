-- ============================================================
-- 023_fix_review_rating_recalculation.sql
--
-- Fixes review editing when the star rating changes.
--
-- Sellers still cannot change their own rating manually.
-- The database may update rating_avg when a buyer's legitimate
-- review causes the automatic rating trigger to recalculate it.
-- ============================================================


create or replace function public.protect_seller_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  /*
   * Database/service operations are allowed.
   */
  if auth.uid() is null then
    return new;
  end if;


  /*
   * Teraa administrators may perform administrative changes.
   */
  if public.current_user_is_admin() then
    return new;
  end if;


  -- ==========================================================
  -- SELLER INSERT
  -- ==========================================================

  if tg_op = 'INSERT' then

    if new.id <> auth.uid() then
      raise exception
        'You cannot create a seller account for another user.';
    end if;


    if new.verification_status::text <> 'pending' then
      raise exception
        'New seller accounts must begin with pending verification.';
    end if;


    if new.account_status <> 'active' then
      raise exception
        'New seller accounts must begin active.';
    end if;


    if coalesce(new.rating_avg, 0) <> 0 then
      raise exception
        'Seller rating cannot be set manually.';
    end if;


    if coalesce(new.total_sales, 0) <> 0 then
      raise exception
        'Seller sales count cannot be set manually.';
    end if;


    if new.admin_note is not null then
      raise exception
        'Admin notes cannot be created by sellers.';
    end if;


    if new.verification_request_reason is not null then
      raise exception
        'Verification requests are controlled by Teraa.';
    end if;


    if new.status_updated_at is not null then
      raise exception
        'Seller moderation timestamps are controlled by Teraa.';
    end if;


    if new.status_updated_by is not null then
      raise exception
        'Seller moderation information is controlled by Teraa.';
    end if;


    return new;

  end if;


  -- ==========================================================
  -- SELLER UPDATE
  -- ==========================================================


  -- Seller ID can never change.
  if new.id is distinct from old.id then
    raise exception
      'Seller account ID cannot be changed.';
  end if;


  -- ----------------------------------------------------------
  -- VERIFICATION STATUS
  -- ----------------------------------------------------------
  --
  -- Keep the rejected -> pending resubmission path.
  -- Other verification changes remain protected by the
  -- verification-specific triggers/RPC.
  -- ----------------------------------------------------------

  if new.verification_status
       is distinct from old.verification_status then

    if not (
      old.verification_status::text = 'rejected'
      and new.verification_status::text = 'pending'
    ) then

      raise exception
        'Seller verification status can only be changed by Teraa.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- SELLER ACCOUNT STATUS
  -- ----------------------------------------------------------

  if new.account_status
       is distinct from old.account_status then

    raise exception
      'Seller account status can only be changed by Teraa.';

  end if;


  -- ----------------------------------------------------------
  -- ADMIN NOTE
  -- ----------------------------------------------------------

  if new.admin_note
       is distinct from old.admin_note then

    raise exception
      'Admin notes can only be changed by Teraa.';

  end if;


  -- ----------------------------------------------------------
  -- VERIFICATION REQUEST REASON
  -- ----------------------------------------------------------

  if new.verification_request_reason
       is distinct from old.verification_request_reason then

    if not (
      new.verification_request_reason is null
      and new.verification_status::text = 'pending'
    ) then

      raise exception
        'Verification request information can only be changed by Teraa.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- MODERATION TIMESTAMP
  -- ----------------------------------------------------------

  if new.status_updated_at
       is distinct from old.status_updated_at then

    raise exception
      'Seller moderation timestamps can only be changed by Teraa.';

  end if;


  -- ----------------------------------------------------------
  -- MODERATION ACTOR
  -- ----------------------------------------------------------

  if new.status_updated_by
       is distinct from old.status_updated_by then

    raise exception
      'Seller moderation information can only be changed by Teraa.';

  end if;


  -- ----------------------------------------------------------
  -- RATING
  -- ----------------------------------------------------------
  --
  -- A seller must never be able to directly change their own
  -- rating.
  --
  -- However, when a BUYER creates or edits a legitimate review,
  -- the review-rating trigger updates the seller's rating_avg.
  --
  -- In that case:
  --
  -- auth.uid() = buyer
  -- old.id/new.id = seller
  --
  -- so auth.uid() is different from the seller ID.
  --
  -- Direct client updates by unrelated users remain blocked by
  -- the sellers table RLS policies.
  -- ----------------------------------------------------------

  if new.rating_avg
       is distinct from old.rating_avg then

    if auth.uid() = old.id then

      raise exception
        'Seller rating is calculated automatically.';

    end if;

  end if;


  -- ----------------------------------------------------------
  -- TOTAL SALES
  -- ----------------------------------------------------------
  --
  -- Sellers still cannot manually inflate their sales count.
  -- ----------------------------------------------------------

  if new.total_sales
       is distinct from old.total_sales then

    raise exception
      'Seller sales count is controlled by Teraa.';

  end if;


  -- ----------------------------------------------------------
  -- CREATED AT
  -- ----------------------------------------------------------

  if new.created_at
       is distinct from old.created_at then

    raise exception
      'Seller creation date cannot be changed.';

  end if;


  return new;

end;
$$;