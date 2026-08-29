create or replace function public.sync_seller_application_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.id_document_url is null then
    new.application_submitted_at := null;
  elsif tg_op = 'UPDATE'
    and new.id_document_url is not null
    and old.id_document_url is null then
    new.application_submitted_at :=
      coalesce(new.application_submitted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists sync_seller_application_submission
on public.sellers;

create trigger sync_seller_application_submission
before insert or update of id_document_url
on public.sellers
for each row
execute function public.sync_seller_application_submission();

update public.sellers
set application_submitted_at = null
where verification_status = 'pending'
  and id_document_url is null;

update public.sellers
set application_submitted_at =
  coalesce(application_submitted_at, now())
where id_document_url is not null
  and application_submitted_at is null;