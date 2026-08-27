-- ============================================================
-- 014_messaging_security.sql
--
-- Hardens Teraa conversations and messages.
--
-- Buyers may start conversations with sellers about their
-- active products.
--
-- Sellers cannot manufacture conversations with arbitrary
-- buyers.
--
-- Messages may only be sent by actual conversation
-- participants using their own authenticated user ID.
-- ============================================================


-- ============================================================
-- CONVERSATION CREATION
-- ============================================================

drop policy if exists
"conversations_insert_participant"
on public.conversations;


create policy
"conversations_insert_buyer"
on public.conversations
for insert
to authenticated
with check (

  -- The authenticated person must be the buyer.
  buyer_id = auth.uid()

  -- Buyer cannot message themselves as seller.
  and seller_id <> auth.uid()

  -- The seller must be an approved and active seller.
  and exists (
    select 1
    from public.sellers s
    join public.users u
      on u.id = s.id

    where s.id = seller_id
      and s.verification_status::text = 'approved'
      and s.account_status = 'active'
      and u.account_status = 'active'
  )

  -- Conversation must reference a real active product
  -- belonging to this exact seller.
  and product_id is not null

  and exists (
    select 1
    from public.products p

    where p.id = product_id
      and p.seller_id = seller_id
      and p.status::text = 'active'
  )

);


-- ============================================================
-- CONVERSATION READ ACCESS
-- ============================================================

drop policy if exists
"conversations_select_participant"
on public.conversations;


create policy
"conversations_select_participant"
on public.conversations
for select
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.current_user_is_admin()
);


-- ============================================================
-- MESSAGE READ ACCESS
-- ============================================================

drop policy if exists
"messages_select_participant"
on public.messages;


create policy
"messages_select_participant"
on public.messages
for select
to authenticated
using (

  exists (
    select 1

    from public.conversations c

    where c.id = conversation_id

      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
        or public.current_user_is_admin()
      )
  )

);


-- ============================================================
-- MESSAGE CREATION
-- ============================================================

drop policy if exists
"messages_insert_participant"
on public.messages;


create policy
"messages_insert_participant"
on public.messages
for insert
to authenticated
with check (

  -- Nobody can impersonate another sender.
  sender_id = auth.uid()

  and length(trim(content)) > 0

  -- Prevent huge messages being submitted directly to Supabase.
  and length(content) <= 2000

  and exists (
    select 1

    from public.conversations c

    where c.id = conversation_id

      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
      )
  )

);


-- ============================================================
-- NO CLIENT-SIDE MESSAGE EDITING OR DELETION
-- ============================================================
--
-- Teraa currently does not support editing or deleting sent
-- messages, so we intentionally create no UPDATE or DELETE
-- policies for normal users.
-- ============================================================


-- ============================================================
-- OPTIONAL DUPLICATE-CONVERSATION PROTECTION
-- ============================================================
--
-- One buyer + seller + product combination should normally
-- reuse the same conversation instead of creating duplicates.
-- ============================================================

create unique index if not exists
conversations_unique_buyer_seller_product_idx
on public.conversations (
  buyer_id,
  seller_id,
  product_id
)
where product_id is not null;