-- The Gambia's mobile numbering plan changed from 7 to 9 digits
-- on 4 September 2026. Keep accepting legacy numbers during the
-- official transition period while allowing the new operator prefixes.

alter table public.users
  drop constraint if exists users_phone_number_gambian_format;

alter table public.users
  add constraint users_phone_number_gambian_format
  check (
    coalesce(account_status, 'active') = 'deleted'
    or phone_number ~ '^\+220(?:[1-9][0-9]{6}|(?:83|86|87)[1-9][0-9]{6})$'
  ) not valid;

comment on constraint users_phone_number_gambian_format on public.users is
  'Active phone numbers use +220 followed by a valid legacy 7-digit number or new 9-digit operator-prefixed number (83, 86 or 87).';
