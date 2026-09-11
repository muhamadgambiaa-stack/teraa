-- Give newly approved sellers a useful welcome notification without
-- creating a second notification for the same approval event.

create or replace function public.notify_seller_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if new.verification_status::text = 'approved' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Welcome to Teraa! Your shop is approved',
        'You can now add your first product and start receiving orders.',
        '/seller/dashboard/new'
      );

    elsif new.verification_status::text = 'rejected' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Verification not approved',
        coalesce(
          new.verification_request_reason,
          'Your seller verification was not approved.'
        ),
        '/seller/dashboard'
      );
    end if;
  end if;

  if new.verification_request_reason is distinct from old.verification_request_reason
     and new.verification_request_reason is not null
     and length(trim(new.verification_request_reason)) > 0 then
    insert into public.notifications (
      user_id, type, title, message, link
    )
    values (
      new.id,
      'verification',
      'Additional verification required',
      new.verification_request_reason,
      '/seller/dashboard/verify'
    );
  end if;

  if new.account_status is distinct from old.account_status then
    if new.account_status::text = 'suspended' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'moderation',
        'Seller account suspended',
        coalesce(
          new.admin_note,
          'Your seller account has been suspended.'
        ),
        '/seller/dashboard'
      );

    elsif new.account_status::text = 'banned' then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'moderation',
        'Seller account banned',
        coalesce(
          new.admin_note,
          'Your seller account has been banned.'
        ),
        '/seller/dashboard'
      );

    elsif new.account_status::text = 'active'
      and old.account_status::text in ('suspended', 'banned') then
      insert into public.notifications (
        user_id, type, title, message, link
      )
      values (
        new.id,
        'verification',
        'Seller account restored',
        'Your seller account is active again.',
        '/seller/dashboard'
      );
    end if;
  end if;

  return new;
end;
$$;

-- Trigger functions are invoked by Postgres and must not be callable as RPCs.
revoke execute on function public.notify_seller_changes()
from public, anon, authenticated;
