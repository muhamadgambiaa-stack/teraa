create schema if not exists private;

create or replace function private.mark_profile_deleted_after_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set
    full_name = 'Deleted user',
    phone_number = 'deleted-' || replace(old.id::text, '-', ''),
    city = null,
    profile_photo_url = null,
    is_verified = false,
    account_status = 'deleted',
    restriction_reason = null,
    restricted_at = null,
    restricted_by = null,
    deleted_at = coalesce(deleted_at, now())
  where id = old.id;

  return old;
end;
$$;

revoke all on function private.mark_profile_deleted_after_auth_user() from public;

drop trigger if exists mark_profile_deleted_after_auth_user on auth.users;

create trigger mark_profile_deleted_after_auth_user
after delete on auth.users
for each row
execute function private.mark_profile_deleted_after_auth_user();

-- Repair profiles left behind by older account-deletion attempts.
update public.users as profile
set
  full_name = 'Deleted user',
  phone_number = 'deleted-' || replace(profile.id::text, '-', ''),
  city = null,
  profile_photo_url = null,
  is_verified = false,
  account_status = 'deleted',
  restriction_reason = null,
  restricted_at = null,
  restricted_by = null,
  deleted_at = coalesce(profile.deleted_at, now())
where profile.account_status <> 'deleted'
  and not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = profile.id
  );
