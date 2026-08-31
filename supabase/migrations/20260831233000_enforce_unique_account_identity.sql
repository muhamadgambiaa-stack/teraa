-- One active Teraa account per phone number.
-- Email uniqueness is already enforced by Supabase Auth.

create unique index if not exists users_unique_active_phone_number
on public.users (
  regexp_replace(phone_number, '[^0-9]+', '', 'g')
)
where
  coalesce(account_status, 'active') <> 'deleted'
  and nullif(regexp_replace(coalesce(phone_number, ''), '[^0-9]+', '', 'g'), '') is not null;

comment on index public.users_unique_active_phone_number is
  'Prevents one normalized phone number from belonging to multiple active Teraa accounts.';
