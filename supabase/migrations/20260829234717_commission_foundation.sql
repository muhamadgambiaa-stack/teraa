create table if not exists public.commission_settings (
  id boolean primary key default true check (id = true),
  commission_rate numeric(6,5) not null default 0.05
    check (commission_rate >= 0 and commission_rate <= 1),
  payment_window_hours integer not null default 6
    check (payment_window_hours between 1 and 168),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

insert into public.commission_settings (
  id,
  commission_rate,
  payment_window_hours
)
values (true, 0.05, 6)
on conflict (id) do nothing;

alter table public.commission_settings enable row level security;

revoke all on public.commission_settings from anon;
revoke all on public.commission_settings from authenticated;

grant select, update on public.commission_settings to authenticated;

drop policy if exists "commission_settings_authenticated_read"
on public.commission_settings;

create policy "commission_settings_authenticated_read"
on public.commission_settings
for select
to authenticated
using (true);

drop policy if exists "commission_settings_admin_update"
on public.commission_settings;

create policy "commission_settings_admin_update"
on public.commission_settings
for update
to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

alter table public.commissions
  add column if not exists seller_id uuid references public.sellers(id),
  add column if not exists order_total numeric(14,2),
  add column if not exists status text,
  add column if not exists due_at timestamptz,
  add column if not exists deadline_paused_at timestamptz,
  add column if not exists instructions_requested_at timestamptz,
  add column if not exists instructions_provided_at timestamptz,
  add column if not exists payment_instructions text,
  add column if not exists proof_path text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists admin_note text,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.commissions c
set
  seller_id = o.seller_id,
  order_total = totals.order_total,
  status = 'waived',
  updated_at = now()
from public.orders o
left join lateral (
  select coalesce(
    sum(oi.quantity * oi.price_at_purchase),
    0
  )::numeric(14,2) as order_total
  from public.order_items oi
  where oi.order_id = o.id
) totals on true
where o.id = c.order_id
  and (
    c.seller_id is null
    or c.order_total is null
    or c.status is null
  );

alter table public.commissions
  alter column seller_id set not null,
  alter column order_total set not null,
  alter column status set default 'awaiting_payment',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commissions_status_check'
      and conrelid = 'public.commissions'::regclass
  ) then
    alter table public.commissions
      add constraint commissions_status_check
      check (
        status in (
          'awaiting_payment',
          'instructions_requested',
          'proof_submitted',
          'paid',
          'overdue',
          'rejected',
          'waived'
        )
      );
  end if;
end;
$$;

create unique index if not exists commissions_order_id_unique
on public.commissions(order_id);

create index if not exists commissions_seller_status_idx
on public.commissions(seller_id, status);

create index if not exists commissions_due_idx
on public.commissions(due_at)
where status in ('awaiting_payment', 'rejected');

alter table public.commissions enable row level security;

revoke all on public.commissions from anon;
revoke all on public.commissions from authenticated;

grant select on public.commissions to authenticated;

drop policy if exists "commissions_seller_read_own"
on public.commissions;

create policy "commissions_seller_read_own"
on public.commissions
for select
to authenticated
using ((select auth.uid()) = seller_id);

drop policy if exists "commissions_admin_read_all"
on public.commissions;

create policy "commissions_admin_read_all"
on public.commissions
for select
to authenticated
using ((select public.current_user_is_admin()));

create or replace function public.create_commission_on_order_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric(6,5);
  v_window_hours integer;
  v_order_total numeric(14,2);
  v_commission_amount numeric(14,2);
  v_commission_id uuid;
begin
  if new.status::text <> 'completed'
     or old.status::text = 'completed' then
    return new;
  end if;

  select
    cs.commission_rate,
    cs.payment_window_hours
  into
    v_rate,
    v_window_hours
  from public.commission_settings cs
  where cs.id = true;

  if not found then
    raise exception 'Commission settings are missing.';
  end if;

  select coalesce(
    sum(oi.quantity * oi.price_at_purchase),
    0
  )::numeric(14,2)
  into v_order_total
  from public.order_items oi
  where oi.order_id = new.id;

  if v_order_total <= 0 then
    raise exception 'Cannot calculate commission for an empty order.';
  end if;

  v_commission_amount :=
    round(v_order_total * v_rate, 2);

  insert into public.commissions (
    order_id,
    seller_id,
    order_total,
    commission_rate,
    commission_amount,
    seller_payout_status,
    status,
    due_at
  )
  values (
    new.id,
    new.seller_id,
    v_order_total,
    v_rate,
    v_commission_amount,
    'pending',
    'awaiting_payment',
    now() + make_interval(hours => v_window_hours)
  )
  on conflict (order_id) do nothing
  returning id into v_commission_id;

  if v_commission_id is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    values (
      new.seller_id,
      'commission_created',
      'Commission payment required',
      'A 5% Teraa commission is due within six hours for a completed order.',
      '/seller/dashboard/commissions'
    );
  end if;

  return new;
end;
$$;

revoke all
on function public.create_commission_on_order_completion()
from public, anon, authenticated;

drop trigger if exists create_commission_on_order_completion
on public.orders;

create trigger create_commission_on_order_completion
after update of status
on public.orders
for each row
execute function public.create_commission_on_order_completion();