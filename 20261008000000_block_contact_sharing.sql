-- Block phone numbers, messaging apps, emails and links in chat messages and
-- listing titles/descriptions so deals stay inside Teraa.
-- Safe to run once. Existing rows are not changed. Listings that already
-- contain contact details can only be edited after the details are removed.

create schema if not exists private;

create or replace function private.contains_contact_info(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
begin
  if p_text is null or btrim(p_text) = '' then
    return false;
  end if;

  t := lower(p_text);
  t := regexp_replace(t, 'getteraa\.com', ' ', 'g');
  t := regexp_replace(t, '(gmd|dalasis?)\s*[0-9][0-9 ]*', ' ', 'g');
  t := regexp_replace(t, '(?<=[0-9])[\s.\-()]+(?=[0-9])', '', 'g');

  return t ~ '[0-9]{7,}'
    or t ~ '(whats ?app|whatsap|watsapp|wa\.me|telegram|t\.me|viber|call me|text me|my number|my phone|contact me|outside (the )?app|outside teraa|off teraa|pay me directly)'
    or t ~ '[a-z0-9._%+-]+ ?(@|\(at\)|\[at\]) ?[a-z0-9-]+ ?(\.|\(dot\)|\[dot\]) ?[a-z]{2,}'
    or t ~ '(https?://|www\.)'
    or t ~ '\m[a-z0-9-]+\.(com|net|org|gm|me|app|link|co)\M';
end;
$$;

revoke all on function private.contains_contact_info(text) from public;

create or replace function private.block_contact_in_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.contains_contact_info(new.content) then
    raise exception 'contact_info_not_allowed';
  end if;
  return new;
end;
$$;

create or replace function private.block_contact_in_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.contains_contact_info(new.title)
     or private.contains_contact_info(new.description) then
    raise exception 'contact_info_not_allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists block_contact_in_message on public.messages;
create trigger block_contact_in_message
  before insert on public.messages
  for each row execute function private.block_contact_in_message();

drop trigger if exists block_contact_in_product_insert on public.products;
create trigger block_contact_in_product_insert
  before insert on public.products
  for each row execute function private.block_contact_in_product();

drop trigger if exists block_contact_in_product_update on public.products;
create trigger block_contact_in_product_update
  before update on public.products
  for each row
  when (old.title is distinct from new.title
        or old.description is distinct from new.description)
  execute function private.block_contact_in_product();
