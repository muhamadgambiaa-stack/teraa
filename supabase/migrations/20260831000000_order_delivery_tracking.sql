alter table public.orders
  add column if not exists delivery_handler text,
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_phone text,
  add column if not exists delivery_tracking_reference text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders
  drop constraint if exists orders_delivery_handler_check,
  add constraint orders_delivery_handler_check
    check (
      delivery_handler is null
      or delivery_handler in ('seller', 'rider', 'courier')
    ),
  drop constraint if exists orders_delivery_contact_name_check,
  add constraint orders_delivery_contact_name_check
    check (
      delivery_contact_name is null
      or char_length(btrim(delivery_contact_name)) between 2 and 100
    ),
  drop constraint if exists orders_delivery_contact_phone_check,
  add constraint orders_delivery_contact_phone_check
    check (
      delivery_contact_phone is null
      or char_length(btrim(delivery_contact_phone)) between 7 and 30
    ),
  drop constraint if exists orders_delivery_tracking_reference_check,
  add constraint orders_delivery_tracking_reference_check
    check (
      delivery_tracking_reference is null
      or char_length(btrim(delivery_tracking_reference)) between 1 and 120
    );

create or replace function public.validate_order_delivery_tracking()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status::text = 'shipped'
     and old.status::text is distinct from 'shipped' then
    if new.delivery_handler is null
       or new.delivery_contact_name is null
       or new.delivery_contact_phone is null then
      raise exception 'delivery_tracking_details_required';
    end if;

    new.delivery_contact_name := btrim(new.delivery_contact_name);
    new.delivery_contact_phone := btrim(new.delivery_contact_phone);
    new.delivery_tracking_reference := nullif(
      btrim(new.delivery_tracking_reference),
      ''
    );
    new.shipped_at := coalesce(new.shipped_at, now());
  end if;

  if new.status::text = 'delivered'
     and old.status::text is distinct from 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_delivery_tracking_trigger
  on public.orders;

create trigger validate_order_delivery_tracking_trigger
before update on public.orders
for each row
execute function public.validate_order_delivery_tracking();

revoke execute on function public.validate_order_delivery_tracking()
  from public, anon, authenticated;

create or replace function public.seller_mark_order_shipped(
  p_order_id uuid,
  p_delivery_handler text,
  p_contact_name text,
  p_contact_phone text,
  p_tracking_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if p_delivery_handler not in ('seller', 'rider', 'courier') then
    raise exception 'invalid_delivery_handler';
  end if;

  if char_length(btrim(coalesce(p_contact_name, ''))) not between 2 and 100 then
    raise exception 'invalid_delivery_contact_name';
  end if;

  if char_length(btrim(coalesce(p_contact_phone, ''))) not between 7 and 30 then
    raise exception 'invalid_delivery_contact_phone';
  end if;

  if char_length(btrim(coalesce(p_tracking_reference, ''))) > 120 then
    raise exception 'tracking_reference_too_long';
  end if;

  update public.orders o
  set
    status = 'shipped'::public.order_status,
    delivery_handler = p_delivery_handler,
    delivery_contact_name = btrim(p_contact_name),
    delivery_contact_phone = btrim(p_contact_phone),
    delivery_tracking_reference = nullif(btrim(p_tracking_reference), '')
  from public.sellers s, public.users u
  where o.id = p_order_id
    and o.seller_id = v_user_id
    and o.status::text = 'confirmed'
    and s.id = v_user_id
    and s.verification_status::text = 'approved'
    and s.account_status = 'active'
    and u.id = v_user_id
    and u.account_status = 'active';

  if not found then
    raise exception 'order_not_available_for_shipping';
  end if;
end;
$$;

revoke all on function public.seller_mark_order_shipped(
  uuid,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.seller_mark_order_shipped(
  uuid,
  text,
  text,
  text,
  text
) to authenticated;
