alter table public.order_delivery_issues
  add column if not exists response_deadline timestamptz,
  add column if not exists seller_response text,
  add column if not exists seller_responded_at timestamptz,
  add column if not exists auto_restricted_at timestamptz;

update public.order_delivery_issues
set response_deadline = reported_at + interval '48 hours'
where response_deadline is null;

alter table public.order_delivery_issues
  drop constraint if exists order_delivery_issues_seller_response_length_check,
  add constraint order_delivery_issues_seller_response_length_check
    check (
      seller_response is null
      or char_length(btrim(seller_response)) between 20 and 2000
    );

create or replace function public.set_delivery_issue_response_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.response_deadline := coalesce(
    new.response_deadline,
    coalesce(new.reported_at, now()) + interval '48 hours'
  );
  return new;
end;
$$;

revoke all on function public.set_delivery_issue_response_deadline()
from public, anon, authenticated;

drop trigger if exists set_delivery_issue_response_deadline
on public.order_delivery_issues;

create trigger set_delivery_issue_response_deadline
before insert on public.order_delivery_issues
for each row
execute function public.set_delivery_issue_response_deadline();

create or replace function public.notify_delivery_issue_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.seller_id,
    'delivery_dispute',
    'Respond to a delivery dispute',
    'A buyer reported that order #' || left(new.order_id::text, 8) ||
      ' was not received. Respond within 48 hours to avoid an automatic account restriction.',
    '/seller/dashboard/orders/' || new.order_id::text
  );

  insert into public.notifications (user_id, type, title, message, link)
  select
    u.id,
    'delivery_dispute',
    'New delivery dispute',
    'A buyer reported order #' || left(new.order_id::text, 8) ||
      ' as not received. The seller has 48 hours to respond.',
    '/admin/disputes'
  from public.users u
  where u.role::text = 'admin';

  return new;
end;
$$;

revoke all on function public.notify_delivery_issue_deadline()
from public, anon, authenticated;

drop trigger if exists notify_delivery_issue_deadline
on public.order_delivery_issues;

create trigger notify_delivery_issue_deadline
after insert on public.order_delivery_issues
for each row
execute function public.notify_delivery_issue_deadline();

create or replace function public.seller_respond_to_delivery_issue(
  p_order_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_response text := btrim(coalesce(p_response, ''));
  v_issue public.order_delivery_issues%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if char_length(v_response) not between 20 and 2000 then
    raise exception 'response_must_be_between_20_and_2000_characters'
      using errcode = '22023';
  end if;

  select *
  into v_issue
  from public.order_delivery_issues
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'delivery_issue_not_found';
  end if;

  if v_issue.seller_id <> v_user_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_issue.status::text <> 'open' then
    raise exception 'delivery_issue_is_not_open';
  end if;

  if v_issue.seller_responded_at is not null then
    raise exception 'delivery_issue_already_responded';
  end if;

  if v_issue.response_deadline <= now() then
    raise exception 'delivery_issue_response_deadline_passed';
  end if;

  update public.order_delivery_issues
  set
    seller_response = v_response,
    seller_responded_at = now()
  where order_id = p_order_id;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_issue.buyer_id,
    'delivery_dispute',
    'Seller responded to your delivery report',
    'The seller responded to the delivery issue for order #' ||
      left(p_order_id::text, 8) || '. Teraa can now review the case.',
    '/orders/' || p_order_id::text
  );

  insert into public.notifications (user_id, type, title, message, link)
  select
    u.id,
    'delivery_dispute',
    'Seller responded to a dispute',
    'The seller responded to delivery dispute #' || left(p_order_id::text, 8) || '.',
    '/admin/disputes'
  from public.users u
  where u.role::text = 'admin';
end;
$$;

revoke all on function public.seller_respond_to_delivery_issue(uuid, text)
from public, anon;

grant execute on function public.seller_respond_to_delivery_issue(uuid, text)
to authenticated;

create or replace function public.enforce_delivery_dispute_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue record;
  v_count integer := 0;
  v_reason text;
begin
  for v_issue in
    select i.id, i.order_id, i.seller_id
    from public.order_delivery_issues i
    where i.status::text = 'open'
      and i.seller_responded_at is null
      and i.auto_restricted_at is null
      and i.response_deadline <= now()
    for update skip locked
  loop
    v_reason := 'Automatically restricted for not responding within 48 hours to delivery dispute for order #' ||
      left(v_issue.order_id::text, 8) || '.';

    update public.users
    set
      account_status = 'restricted',
      restriction_reason = v_reason,
      restricted_at = now(),
      restricted_by = null
    where id = v_issue.seller_id
      and account_status = 'active';

    update public.sellers
    set
      account_status = 'suspended',
      admin_note = v_reason,
      status_updated_at = now(),
      status_updated_by = null
    where id = v_issue.seller_id
      and account_status = 'active';

    update public.order_delivery_issues
    set auto_restricted_at = now()
    where id = v_issue.id;

    insert into public.notifications (user_id, type, title, message, link)
    select
      u.id,
      'delivery_dispute',
      'Seller automatically restricted',
      v_reason,
      '/admin/disputes'
    from public.users u
    where u.role::text = 'admin';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enforce_delivery_dispute_deadlines()
from public, anon, authenticated;

drop policy if exists "Admins can read delivery issues"
on public.order_delivery_issues;

create policy "Admins can read delivery issues"
on public.order_delivery_issues
for select
to authenticated
using ((select public.current_user_is_admin()));

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'teraa-delivery-dispute-enforcement'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'teraa-delivery-dispute-enforcement',
    '*/5 * * * *',
    'select public.enforce_delivery_dispute_deadlines();'
  );
end;
$$;
