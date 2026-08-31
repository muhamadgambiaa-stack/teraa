-- Database-enforced abuse protection for high-volume marketplace writes.
-- The counters live outside the exposed API schema and can only be changed
-- by the trigger function.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.rate_limit_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action_name text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
on private.rate_limit_events (actor_id, action_name, occurred_at desc);

revoke all on private.rate_limit_events from public;
revoke all on private.rate_limit_events from anon;
revoke all on private.rate_limit_events from authenticated;

create or replace function private.consume_write_quota(
  p_action_name text,
  p_max_attempts integer,
  p_window_seconds integer,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_recent_count integer;
begin
  -- Internal service-role jobs have no end-user JWT and are not throttled.
  if v_actor_id is null then
    return;
  end if;

  if p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  -- Serialize requests for the same user/action to prevent concurrent bypass.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_action_name, 0)
  );

  delete from private.rate_limit_events
  where actor_id = v_actor_id
    and action_name = p_action_name
    and occurred_at < now() - pg_catalog.make_interval(secs => p_window_seconds);

  select count(*)::integer
  into v_recent_count
  from private.rate_limit_events
  where actor_id = v_actor_id
    and action_name = p_action_name
    and occurred_at >= now() - pg_catalog.make_interval(secs => p_window_seconds);

  if v_recent_count >= p_max_attempts then
    raise exception using
      errcode = 'P0001',
      message = p_error_message;
  end if;

  insert into private.rate_limit_events (actor_id, action_name)
  values (v_actor_id, p_action_name);
end;
$$;

revoke all on function private.consume_write_quota(text, integer, integer, text) from public;
revoke all on function private.consume_write_quota(text, integer, integer, text) from anon;
revoke all on function private.consume_write_quota(text, integer, integer, text) from authenticated;

create or replace function private.enforce_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.consume_write_quota(
    tg_argv[0],
    tg_argv[1]::integer,
    tg_argv[2]::integer,
    tg_argv[3]
  );

  return new;
end;
$$;

revoke all on function private.enforce_write_rate_limit() from public;
revoke all on function private.enforce_write_rate_limit() from anon;
revoke all on function private.enforce_write_rate_limit() from authenticated;

drop trigger if exists rate_limit_messages on public.messages;
create trigger rate_limit_messages
before insert on public.messages
for each row execute function private.enforce_write_rate_limit(
  'message', '30', '60',
  'You are sending messages too quickly. Please wait a minute.'
);

drop trigger if exists rate_limit_orders on public.orders;
create trigger rate_limit_orders
before insert on public.orders
for each row execute function private.enforce_write_rate_limit(
  'order', '5', '600',
  'Too many orders were submitted. Please wait 10 minutes.'
);

drop trigger if exists rate_limit_reports on public.reports;
create trigger rate_limit_reports
before insert on public.reports
for each row execute function private.enforce_write_rate_limit(
  'report', '5', '3600',
  'Too many reports were submitted. Please wait before trying again.'
);

drop trigger if exists rate_limit_support_threads on public.support_threads;
create trigger rate_limit_support_threads
before insert on public.support_threads
for each row execute function private.enforce_write_rate_limit(
  'support_thread', '5', '3600',
  'Too many support requests were opened. Please wait before creating another.'
);

drop trigger if exists rate_limit_support_messages on public.support_messages;
create trigger rate_limit_support_messages
before insert on public.support_messages
for each row execute function private.enforce_write_rate_limit(
  'support_message', '60', '600',
  'You are sending support messages too quickly. Please wait a few minutes.'
);

comment on table private.rate_limit_events is
  'Short-lived per-user counters used by database write-rate-limit triggers.';
