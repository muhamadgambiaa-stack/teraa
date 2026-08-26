-- 010_public_profiles.sql
--
-- Safe public marketplace profiles.
-- Never exposes:
-- phone number
-- email
-- ID documents
-- payment information
-- admin notes
-- moderation information

create or replace function public.get_public_profile(
  p_user_id uuid
)
returns table (
  id uuid,
  full_name text,
  city text,
  profile_photo_url text,
  public_role text,

  business_name text,
  shop_description text,
  shop_banner_url text,

  verification_status text,
  rating_avg numeric,
  total_sales integer,

  member_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.full_name,
    u.city,
    u.profile_photo_url,

    case
      when s.id is not null
        and s.account_status = 'active'
        then 'seller'
      else 'buyer'
    end as public_role,

    case
      when s.account_status = 'active'
        then s.business_name
      else null
    end,

    case
      when s.account_status = 'active'
        then s.shop_description
      else null
    end,

    case
      when s.account_status = 'active'
        then s.shop_banner_url
      else null
    end,

    case
      when s.account_status = 'active'
        then s.verification_status::text
      else null
    end,

    case
      when s.account_status = 'active'
        then s.rating_avg
      else null
    end,

    case
      when s.account_status = 'active'
        then s.total_sales
      else null
    end,

    coalesce(s.created_at, now()) as member_since

  from public.users u

  left join public.sellers s
    on s.id = u.id

  where u.id = p_user_id;
$$;


revoke all
on function public.get_public_profile(uuid)
from public;

grant execute
on function public.get_public_profile(uuid)
to anon, authenticated;