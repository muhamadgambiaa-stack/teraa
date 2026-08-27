-- ============================================================
-- 022_review_editing.sql
--
-- Allows buyers to edit their own product reviews.
--
-- Buyers may change:
-- rating
-- comment
--
-- Buyers may NOT change:
-- buyer
-- seller
-- order
-- product
--
-- Sellers cannot edit buyer reviews.
-- ============================================================


-- ============================================================
-- UPDATED AT
-- ============================================================

alter table public.reviews
add column if not exists updated_at timestamptz;


-- ============================================================
-- PROTECT REVIEW OWNERSHIP
-- ============================================================

create or replace function public.protect_review_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Review ID cannot be changed.';
  end if;

  if new.buyer_id is distinct from old.buyer_id then
    raise exception 'Review owner cannot be changed.';
  end if;

  if new.seller_id is distinct from old.seller_id then
    raise exception 'Review seller cannot be changed.';
  end if;

  if new.order_id is distinct from old.order_id then
    raise exception 'Review order cannot be changed.';
  end if;

  if new.product_id is distinct from old.product_id then
    raise exception 'Review product cannot be changed.';
  end if;

  return new;
end;
$$;


drop trigger if exists protect_review_identity_trigger
on public.reviews;

create trigger protect_review_identity_trigger
before update
on public.reviews
for each row
execute function public.protect_review_identity();


-- ============================================================
-- BUYER UPDATE POLICY
-- ============================================================

drop policy if exists
"reviews_update_own_buyer"
on public.reviews;

create policy
"reviews_update_own_buyer"
on public.reviews
for update
to authenticated
using (
  buyer_id = auth.uid()
)
with check (
  buyer_id = auth.uid()

  and exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.buyer_id = auth.uid()
      and o.seller_id = seller_id
      and o.status::text = 'completed'
  )

  and exists (
    select 1
    from public.order_items oi
    where oi.order_id = order_id
      and oi.product_id = product_id
  )
);