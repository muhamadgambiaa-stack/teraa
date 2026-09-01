-- User-controlled inbox removal and safe seller listing deletion.
-- Historical marketplace records are retained for orders, disputes and audit.

alter table public.conversations
  add column if not exists buyer_deleted_at timestamptz,
  add column if not exists seller_deleted_at timestamptz;

alter table public.products
  add column if not exists seller_deleted_at timestamptz;

create index if not exists idx_conversations_buyer_visible
on public.conversations (buyer_id, created_at desc)
where buyer_deleted_at is null;

create index if not exists idx_conversations_seller_visible
on public.conversations (seller_id, created_at desc)
where seller_deleted_at is null;

create index if not exists idx_products_seller_visible
on public.products (seller_id, created_at desc)
where seller_deleted_at is null;

create or replace function public.remove_conversation_from_inbox(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select buyer_id, seller_id
  into v_buyer_id, v_seller_id
  from public.conversations
  where id = p_conversation_id;

  if not found or (v_user_id <> v_buyer_id and v_user_id <> v_seller_id) then
    raise exception 'Conversation not found';
  end if;

  update public.conversations
  set buyer_deleted_at = case
        when v_user_id = v_buyer_id then now()
        else buyer_deleted_at
      end,
      seller_deleted_at = case
        when v_user_id = v_seller_id then now()
        else seller_deleted_at
      end
  where id = p_conversation_id;
end;
$$;

revoke all on function public.remove_conversation_from_inbox(uuid) from public;
revoke all on function public.remove_conversation_from_inbox(uuid) from anon;
grant execute on function public.remove_conversation_from_inbox(uuid) to authenticated;

create or replace function public.restore_my_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.conversations
  set buyer_deleted_at = case
        when buyer_id = v_user_id then null
        else buyer_deleted_at
      end,
      seller_deleted_at = case
        when seller_id = v_user_id then null
        else seller_deleted_at
      end
  where id = p_conversation_id
    and (buyer_id = v_user_id or seller_id = v_user_id);

  if not found then
    raise exception 'Conversation not found';
  end if;
end;
$$;

revoke all on function public.restore_my_conversation(uuid) from public;
revoke all on function public.restore_my_conversation(uuid) from anon;
grant execute on function public.restore_my_conversation(uuid) to authenticated;

create schema if not exists private;

create or replace function private.restore_conversation_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set buyer_deleted_at = null,
      seller_deleted_at = null
  where id = new.conversation_id;

  return new;
end;
$$;

revoke all on function private.restore_conversation_on_new_message() from public;
revoke all on function private.restore_conversation_on_new_message() from anon;
revoke all on function private.restore_conversation_on_new_message() from authenticated;

drop trigger if exists restore_conversation_on_new_message on public.messages;
create trigger restore_conversation_on_new_message
after insert on public.messages
for each row execute function private.restore_conversation_on_new_message();

create or replace function public.seller_delete_listing(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.products
  set seller_deleted_at = now(),
      status = case
        when status = 'admin_hidden'::public.product_status then status
        else 'hidden'::public.product_status
      end
  where id = p_product_id
    and seller_id = v_user_id
    and seller_deleted_at is null;

  if not found then
    raise exception 'Listing not found';
  end if;
end;
$$;

revoke all on function public.seller_delete_listing(uuid) from public;
revoke all on function public.seller_delete_listing(uuid) from anon;
grant execute on function public.seller_delete_listing(uuid) to authenticated;
