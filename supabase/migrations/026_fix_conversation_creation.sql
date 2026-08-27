-- ============================================================
-- 026_fix_conversation_creation.sql
--
-- Fixes normal buyers being unable to start conversations.
--
-- The previous conversation policy checked another user's
-- private users row directly. Because users RLS only allows
-- users to see themselves (or admins), that check failed for
-- ordinary buyers.
--
-- This migration moves seller availability checks into a
-- controlled SECURITY DEFINER helper.
-- ============================================================


-- ============================================================
-- SELLER AVAILABILITY HELPER
-- ============================================================

create or replace function public.marketplace_seller_is_available(
  p_seller_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sellers s
    join public.users u
      on u.id = s.id
    where s.id = p_seller_id
      and s.verification_status::text = 'approved'
      and s.account_status = 'active'
      and u.account_status = 'active'
  );
$$;


revoke all
on function public.marketplace_seller_is_available(uuid)
from public;

grant execute
on function public.marketplace_seller_is_available(uuid)
to authenticated;


-- ============================================================
-- REPLACE CONVERSATION INSERT POLICY
-- ============================================================

drop policy if exists
"conversations_buyer_insert"
on public.conversations;


create policy
"conversations_buyer_insert"
on public.conversations
for insert
to authenticated
with check (

  -- Authenticated user must be the buyer.
  buyer_id = auth.uid()

  -- Restricted users cannot start conversations.
  and public.current_user_is_active()

  -- Cannot create a buyer conversation with yourself.
  and seller_id <> auth.uid()

  -- Teraa product conversations must reference a product.
  and product_id is not null

  -- Seller must be verified and fully active.
  and public.marketplace_seller_is_available(
    seller_id
  )

  -- Product must actually belong to this exact seller.
  and exists (
    select 1
    from public.products p
    where p.id = conversations.product_id
      and p.seller_id = conversations.seller_id
      and p.status::text in (
        'active',
        'out_of_stock'
      )
  )
);