-- ============================================================
-- 025_secure_messaging_rls.sql
-- TERAA MESSAGING SECURITY
--
-- Goals:
-- 1. Only buyers can start conversations.
-- 2. Conversation must reference the exact seller/product.
-- 3. Only participants/admin can read conversations.
-- 4. Messages must be sent as the authenticated user.
-- 5. Message content/sender/identity cannot be edited.
-- 6. Participants may only update read_at.
-- ============================================================


-- ============================================================
-- CONVERSATIONS
-- ============================================================

alter table public.conversations
enable row level security;


-- Remove duplicate / older policies.

drop policy if exists
"conversations_insert_buyer"
on public.conversations;

drop policy if exists
"conversations_insert_participants"
on public.conversations;

drop policy if exists
"conversations_select_participant"
on public.conversations;


-- ------------------------------------------------------------
-- BUYER STARTS CONVERSATION
-- ------------------------------------------------------------

create policy
"conversations_buyer_insert"
on public.conversations
for insert
to authenticated
with check (

  buyer_id = auth.uid()

  and public.current_user_is_active()

  and seller_id <> auth.uid()

  and product_id is not null

  and exists (
    select 1
    from public.products p
    join public.sellers s
      on s.id = p.seller_id
    join public.users u
      on u.id = p.seller_id

    where p.id = conversations.product_id
      and p.seller_id = conversations.seller_id
      and p.status::text in ('active', 'out_of_stock')
      and s.verification_status::text = 'approved'
      and s.account_status = 'active'
      and u.account_status = 'active'
  )
);


-- ------------------------------------------------------------
-- PARTICIPANTS READ
-- ------------------------------------------------------------

create policy
"conversations_participant_select"
on public.conversations
for select
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.current_user_is_admin()
);


-- ============================================================
-- MESSAGES
-- ============================================================

alter table public.messages
enable row level security;


-- Remove duplicate / unsafe policies.

drop policy if exists
"messages_insert_participant"
on public.messages;

drop policy if exists
"messages_insert_participants"
on public.messages;

drop policy if exists
"messages_select_participant"
on public.messages;

drop policy if exists
"messages_update_participants"
on public.messages;


-- ------------------------------------------------------------
-- MESSAGE READ
-- ------------------------------------------------------------

create policy
"messages_participant_select"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
        or public.current_user_is_admin()
      )
  )
);


-- ------------------------------------------------------------
-- MESSAGE INSERT
-- ------------------------------------------------------------

create policy
"messages_participant_insert"
on public.messages
for insert
to authenticated
with check (

  sender_id = auth.uid()

  and public.current_user_is_active()

  and length(trim(content)) > 0

  and length(content) <= 2000

  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
      )
  )
);


-- ============================================================
-- PROTECT MESSAGE IDENTITY + CONTENT
-- ============================================================

create or replace function public.protect_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;


  -- Message identity cannot change.

  if new.id is distinct from old.id then
    raise exception
      'Message ID cannot be changed.';
  end if;


  if new.conversation_id
       is distinct from old.conversation_id then

    raise exception
      'Message conversation cannot be changed.';

  end if;


  if new.sender_id
       is distinct from old.sender_id then

    raise exception
      'Message sender cannot be changed.';

  end if;


  -- Sent message content cannot be rewritten.

  if new.content
       is distinct from old.content then

    raise exception
      'Sent messages cannot be edited.';

  end if;


  if new.created_at
       is distinct from old.created_at then

    raise exception
      'Message creation time cannot be changed.';

  end if;


  return new;

end;
$$;


drop trigger if exists
protect_message_update_trigger
on public.messages;


create trigger
protect_message_update_trigger
before update
on public.messages
for each row
execute function public.protect_message_update();


-- ============================================================
-- READ RECEIPTS
-- ============================================================
--
-- Only the OTHER participant may mark a message as read.
--
-- The sender cannot manipulate their own read receipt.
-- ============================================================

create policy
"messages_recipient_update_read"
on public.messages
for update
to authenticated
using (
  sender_id <> auth.uid()

  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
      )
  )
)
with check (
  sender_id <> auth.uid()

  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
      )
  )
);


-- ============================================================
-- DUPLICATE CONVERSATION PROTECTION
-- ============================================================

create unique index if not exists
conversations_unique_buyer_seller_product_idx
on public.conversations (
  buyer_id,
  seller_id,
  product_id
)
where product_id is not null;