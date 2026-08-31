-- Save browser push subscriptions through a narrow authenticated RPC.
-- A browser endpoint can already belong to a previous signed-in account,
-- so a normal client-side upsert cannot securely pass row-level security.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
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

  if p_endpoint is null or btrim(p_endpoint) = '' or length(p_endpoint) > 4096 then
    raise exception 'Invalid push endpoint';
  end if;

  if p_p256dh is null or btrim(p_p256dh) = '' or length(p_p256dh) > 512 then
    raise exception 'Invalid push public key';
  end if;

  if p_auth is null or btrim(p_auth) = '' or length(p_auth) > 512 then
    raise exception 'Invalid push authentication key';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    updated_at
  )
  values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    now()
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public;
revoke all on function public.save_push_subscription(text, text, text) from anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;

create policy "Users can view own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);
