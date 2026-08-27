-- ============================================================
-- MIGRATION 030
-- SECURE REPORT SUBMISSIONS
-- ============================================================

create or replace function public.protect_report_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ----------------------------------------------------------
  -- New reports must always begin as OPEN.
  -- ----------------------------------------------------------
  if new.status::text <> 'open' then
    raise exception 'New reports must start with open status.';
  end if;


  -- ----------------------------------------------------------
  -- SELLER REPORT
  -- ----------------------------------------------------------
  if new.target_type::text = 'seller' then

    if not exists (
      select 1
      from public.sellers s
      where s.id = new.target_id
    ) then
      raise exception 'The reported seller does not exist.';
    end if;


  -- ----------------------------------------------------------
  -- PRODUCT REPORT
  -- ----------------------------------------------------------
  elsif new.target_type::text = 'product' then

    if not exists (
      select 1
      from public.products p
      where p.id = new.target_id
    ) then
      raise exception 'The reported product does not exist.';
    end if;


  -- ----------------------------------------------------------
  -- ORDER REPORT
  -- ----------------------------------------------------------
  elsif new.target_type::text = 'order' then

    if not exists (
      select 1
      from public.orders o
      where o.id = new.target_id
        and (
          o.buyer_id = auth.uid()
          or o.seller_id = auth.uid()
          or public.current_user_is_admin()
        )
    ) then
      raise exception
        'You cannot report an order you are not involved in.';
    end if;


  else
    raise exception 'Invalid report target type.';
  end if;


  return new;
end;
$$;


drop trigger if exists protect_report_submission_trigger
on public.reports;

create trigger protect_report_submission_trigger
before insert
on public.reports
for each row
execute function public.protect_report_submission();