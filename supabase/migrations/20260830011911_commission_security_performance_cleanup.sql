create index if not exists commission_listing_holds_seller_id_idx
on public.commission_listing_holds(seller_id);

create index if not exists commission_listing_holds_commission_id_idx
on public.commission_listing_holds(commission_id);

create index if not exists commission_settings_updated_by_idx
on public.commission_settings(updated_by)
where updated_by is not null;

create index if not exists commissions_reviewed_by_idx
on public.commissions(reviewed_by)
where reviewed_by is not null;

drop policy if exists "commission_listing_holds_no_direct_access"
on public.commission_listing_holds;

create policy "commission_listing_holds_no_direct_access"
on public.commission_listing_holds
for all
to authenticated
using (false)
with check (false);

revoke all
on public.commission_listing_holds
from public, anon, authenticated;
