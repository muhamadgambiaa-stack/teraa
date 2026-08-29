insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'commission-proofs',
  'commission-proofs',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "commission_proofs_seller_insert"
on storage.objects;

create policy "commission_proofs_seller_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'commission-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "commission_proofs_seller_read"
on storage.objects;

create policy "commission_proofs_seller_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'commission-proofs'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.current_user_is_admin())
  )
);

create or replace function public.request_commission_payment_details(
  p_commission_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_commission public.commissions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
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
    'rejected'
  ) then
    raise exception 'payment_details_unavailable';
  end if;

  if v_commission.due_at <= now() then
    raise exception 'commission_deadline_passed';
  end if;

  update public.commissions
  set
    status = 'instructions_requested',
    instructions_requested_at = now(),
    deadline_paused_at = now(),
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
    'commission_instructions_requested',
    'Seller requested payment details',
    'A seller is waiting for commission payment instructions.',
    '/admin/commissions/' || p_commission_id::text
  from public.users u
  where u.role::text = 'admin';
end;
$$;

revoke all
on function public.request_commission_payment_details(uuid)
from public, anon;

grant execute
on function public.request_commission_payment_details(uuid)
to authenticated;

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
    'rejected'
  ) then
    raise exception 'proof_submission_unavailable';
  end if;

  if v_commission.due_at <= now() then
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