alter table public.sellers
  add column if not exists commission_suspended_at timestamptz,
  add column if not exists commission_suspension_reason text;

create table if not exists public.commission_listing_holds (
  product_id uuid primary key references public.products(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  previous_status text not null
    check (previous_status in ('active', 'out_of_stock')),
  created_at timestamptz not null default now()
);

alter table public.commission_listing_holds enable row level security;

revoke all on public.commission_listing_holds from anon, authenticated;

create or replace function public.restore_commission_seller_if_clear(
  p_seller_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restored boolean := false;
begin
  if exists (
    select 1
    from public.commissions c
    where c.seller_id = p_seller_id
      and c.status = 'overdue'
  ) then
    return;
  end if;

  update public.sellers
  set
    account_status = 'active',
    commission_suspended_at = null,
    commission_suspension_reason = null,
    status_updated_at = now()
  where id = p_seller_id
    and account_status = 'suspended'
    and commission_suspended_at is not null;

  v_restored := found;

  update public.products p
  set status = h.previous_status::public.product_status
  from public.commission_listing_holds h
  where h.product_id = p.id
    and h.seller_id = p_seller_id
    and p.status::text = 'hidden';

  delete from public.commission_listing_holds
  where seller_id = p_seller_id;

  if v_restored then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      p_seller_id,
      'commission_access_restored',
      'Selling access restored',
      'Your overdue commission has been resolved. Your eligible listings are visible again.',
      '/seller/dashboard/commissions'
    );
  end if;
end;
$$;

revoke all
on function public.restore_commission_seller_if_clear(uuid)
from public, anon, authenticated;

create or replace function public.enforce_overdue_commissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commission record;
  v_count integer := 0;
begin
  for v_commission in
    update public.commissions
    set
      status = 'overdue',
      updated_at = now()
    where status in ('awaiting_payment', 'rejected')
      and deadline_paused_at is null
      and due_at is not null
      and due_at <= now()
    returning id, seller_id, commission_amount
  loop
    v_count := v_count + 1;

    insert into public.commission_listing_holds (
      product_id,
      seller_id,
      commission_id,
      previous_status
    )
    select
      p.id,
      p.seller_id,
      v_commission.id,
      p.status::text
    from public.products p
    where p.seller_id = v_commission.seller_id
      and p.status::text in ('active', 'out_of_stock')
    on conflict (product_id) do nothing;

    update public.products
    set status = 'hidden'
    where seller_id = v_commission.seller_id
      and status::text in ('active', 'out_of_stock');

    update public.sellers
    set
      account_status = 'suspended',
      commission_suspended_at =
        coalesce(commission_suspended_at, now()),
      commission_suspension_reason =
        'Overdue Teraa commission',
      status_updated_at = now()
    where id = v_commission.seller_id
      and account_status = 'active';

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      v_commission.seller_id,
      'commission_overdue',
      'Commission payment overdue',
      'Your selling access and eligible listings are paused until the overdue commission is resolved.',
      '/seller/dashboard/commissions'
    );
  end loop;

  return v_count;
end;
$$;

revoke all
on function public.enforce_overdue_commissions()
from public, anon, authenticated;

create or replace function public.restore_seller_after_commission_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('paid', 'waived')
     and old.status is distinct from new.status then
    perform public.restore_commission_seller_if_clear(new.seller_id);
  end if;

  return new;
end;
$$;

revoke all
on function public.restore_seller_after_commission_resolution()
from public, anon, authenticated;

drop trigger if exists restore_seller_after_commission_resolution
on public.commissions;

create trigger restore_seller_after_commission_resolution
after update of status
on public.commissions
for each row
execute function public.restore_seller_after_commission_resolution();

create or replace function public.submit_commission_payment_proof(
  p_commission_id uuid,
  p_proof_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_commission public.commissions%rowtype;
  v_clean_path text := btrim(coalesce(p_proof_path, ''));
begin
  if v_user_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  if v_clean_path = ''
     or split_part(v_clean_path, '/', 1) <> v_user_id::text then
    raise exception 'invalid_proof_path'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'commission-proofs'
      and o.name = v_clean_path
  ) then
    raise exception 'proof_file_not_found'
      using errcode = '22023';
  end if;

  select *
  into v_commission
  from public.commissions
  where id = p_commission_id
  for update;

  if not found then
    raise exception 'commission_not_found';
  end if;

  if v_commission.seller_id <> v_user_id then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if v_commission.status not in (
    'awaiting_payment',
    'rejected',
    'overdue'
  ) then
    raise exception 'proof_submission_unavailable';
  end if;

  if v_commission.status <> 'overdue'
     and v_commission.due_at <= now() then
    raise exception 'commission_deadline_passed';
  end if;

  update public.commissions
  set
    status = 'proof_submitted',
    proof_path = v_clean_path,
    proof_submitted_at = now(),
    deadline_paused_at = now(),
    admin_note = null,
    updated_at = now()
  where id = p_commission_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link
  )
  select
    u.id,
    'commission_proof_submitted',
    'Commission proof submitted',
    'A seller submitted commission payment proof for review.',
    '/admin/commissions/' || p_commission_id::text
  from public.users u
  where u.role::text = 'admin';
end;
$$;

revoke all
on function public.submit_commission_payment_proof(uuid, text)
from public, anon;

grant execute
on function public.submit_commission_payment_proof(uuid, text)
to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'teraa-commission-enforcement'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'teraa-commission-enforcement',
    '*/5 * * * *',
    'select public.enforce_overdue_commissions();'
  );
end;
$$;