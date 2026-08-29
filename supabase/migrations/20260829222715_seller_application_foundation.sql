alter table public.sellers
  add column if not exists legal_name text,
  add column if not exists seller_terms_accepted_at timestamptz,
  add column if not exists seller_terms_version text,
  add column if not exists application_submitted_at timestamptz;

update public.sellers s
set
  legal_name = coalesce(
    nullif(btrim(s.legal_name), ''),
    nullif(btrim(u.full_name), ''),
    s.business_name
  ),
  application_submitted_at =
    coalesce(s.application_submitted_at, s.created_at)
from public.users u
where u.id = s.id
  and (
    s.legal_name is null
    or s.application_submitted_at is null
  );

drop policy if exists "sellers_insert_own"
on public.sellers;

drop policy if exists "sellers_insert_legacy_role_only"
on public.sellers;

create policy "sellers_insert_legacy_role_only"
on public.sellers
for insert
to authenticated
with check (
  id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role::text = 'seller'
  )
);

create or replace function public.register_seller_application(
  p_legal_name text,
  p_business_name text,
  p_terms_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_legal_name text := btrim(coalesce(p_legal_name, ''));
  v_business_name text := btrim(coalesce(p_business_name, ''));
  v_terms_version text := btrim(coalesce(p_terms_version, ''));
  v_account_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  select u.account_status
  into v_account_status
  from public.users u
  where u.id = v_user_id;

  if not found then
    raise exception 'profile_required'
      using errcode = '42501';
  end if;

  if v_account_status is distinct from 'active' then
    raise exception 'account_not_active'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.sellers s
    where s.id = v_user_id
  ) then
    raise exception 'seller_application_exists'
      using errcode = '23505';
  end if;

  if char_length(v_legal_name) < 2
     or char_length(v_legal_name) > 120 then
    raise exception 'invalid_legal_name'
      using errcode = '22023';
  end if;

  if char_length(v_business_name) < 2
     or char_length(v_business_name) > 120 then
    raise exception 'invalid_business_name'
      using errcode = '22023';
  end if;

  if v_terms_version = '' then
    raise exception 'seller_terms_required'
      using errcode = '22023';
  end if;

  insert into public.sellers (
    id,
    business_name,
    legal_name,
    verification_status,
    account_status,
    seller_terms_accepted_at,
    seller_terms_version,
    application_submitted_at
  )
  values (
    v_user_id,
    v_business_name,
    v_legal_name,
    'pending',
    'active',
    now(),
    v_terms_version,
    now()
  );
end;
$$;

revoke all
on function public.register_seller_application(text, text, text)
from public;

revoke all
on function public.register_seller_application(text, text, text)
from anon;

grant execute
on function public.register_seller_application(text, text, text)
to authenticated;