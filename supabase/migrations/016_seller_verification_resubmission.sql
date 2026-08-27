-- ============================================================
-- 016_seller_verification_resubmission.sql
--
-- Allows a rejected seller to resubmit verification safely.
--
-- The seller cannot approve themselves.
-- The only allowed self-service transition is:
--
-- rejected -> pending
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
    raise exception 'Verification document is required';
  end if;

  /*
   * The uploaded storage object must live inside
   * the authenticated seller's own folder.
   */
  if split_part(trim(p_document_path), '/', 1)
     <> v_user_id::text then

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

  /*
   * Approved sellers should not use this flow.
   */
  if v_seller.verification_status::text = 'approved' then
    raise exception
      'This seller account is already verified';
  end if;

  /*
   * We only allow:
   *
   * pending -> pending
   * rejected -> pending
   *
   * Never approved.
   */
  update public.sellers
  set
    id_document_url = trim(p_document_path),
    verification_status = 'pending'::verification_status,
    verification_request_reason = null
  where id = v_user_id;

end;
$$;

revoke all
on function public.resubmit_seller_verification(text)
from public;

grant execute
on function public.resubmit_seller_verification(text)
to authenticated;