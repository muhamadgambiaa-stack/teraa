alter table public.sellers
add column if not exists document_sha256 text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sellers_document_sha256_check'
      and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers
    add constraint sellers_document_sha256_check
    check (
      document_sha256 is null
      or document_sha256 ~ '^[0-9a-f]{64}$'
    );
  end if;
end;
$$;

create index if not exists sellers_document_sha256_idx
on public.sellers(document_sha256)
where document_sha256 is not null;

create or replace function public.record_seller_document_fingerprint(
  p_document_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_fingerprint text :=
    lower(btrim(coalesce(p_document_sha256, '')));
begin
  if v_user_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  if v_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_document_fingerprint'
      using errcode = '22023';
  end if;

  update public.sellers
  set document_sha256 = v_fingerprint
  where id = v_user_id
    and id_document_url is not null;

  if not found then
    raise exception 'seller_document_required'
      using errcode = '42501';
  end if;
end;
$$;

revoke all
on function public.record_seller_document_fingerprint(text)
from public, anon;

grant execute
on function public.record_seller_document_fingerprint(text)
to authenticated;
