-- Preserve existing accounts while enforcing the Gambian format for every
-- newly inserted or updated active profile.
alter table public.users
  add constraint users_phone_number_gambian_format
  check (
    coalesce(account_status, 'active') = 'deleted'
    or phone_number ~ '^\+220[1-9][0-9]{6}$'
  ) not valid;

comment on constraint users_phone_number_gambian_format on public.users is
  'Active phone numbers must use +220 followed by exactly seven digits, beginning with 1-9.';
