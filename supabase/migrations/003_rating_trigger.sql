-- ============================================================
-- MIGRATION 003: auto-recalculate seller rating_avg on review changes
-- Run this if you already ran schema.sql before this trigger existed.
-- ============================================================

create or replace function public.recalc_seller_rating() returns trigger as $$
begin
  update public.sellers
  set rating_avg = coalesce((
    select round(avg(rating)::numeric, 1) from public.reviews
    where seller_id = coalesce(new.seller_id, old.seller_id)
  ), 0)
  where id = coalesce(new.seller_id, old.seller_id);
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_recalc_seller_rating on public.reviews;
create trigger trg_recalc_seller_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_seller_rating();
