-- ============================================================
-- GAMBIA MARKETPLACE — CORE SCHEMA (v1 + v2 tables)
-- Paste this whole file into Supabase SQL Editor and run it.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('buyer', 'seller', 'admin');
create type verification_status as enum ('pending', 'approved', 'rejected');
create type product_status as enum ('active', 'out_of_stock', 'hidden');
create type order_status as enum ('placed', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled');
create type payment_method as enum ('digital', 'cod');
create type payment_status as enum ('pending', 'paid', 'failed');
create type payout_status as enum ('pending', 'paid');
create type report_target as enum ('seller', 'product', 'order');
create type report_status as enum ('open', 'reviewed', 'resolved');
create type product_condition as enum ('new', 'used_like_new', 'used_good', 'used_fair');
create type payment_method_type as enum ('bank', 'mobile_money');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique not null,
  full_name text not null,
  role user_role not null default 'buyer',
  city text,
  profile_photo_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SELLERS
-- ============================================================
create table public.sellers (
  id uuid primary key references public.users(id) on delete cascade,
  business_name text not null,
  id_document_url text,
  verification_status verification_status not null default 'pending',
  wave_number text,
  shop_description text,
  shop_banner_url text,
  rating_avg numeric(2,1) not null default 0,
  total_sales integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SELLER PAYMENT METHODS
-- A seller can add one or more ways to pay them directly: a bank
-- account, or a mobile money account (Wave, or any other provider).
-- Cash on delivery is not stored here, it's a universal checkout
-- option that doesn't need a seller to configure anything.
-- ============================================================
create table public.seller_payment_methods (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  method_type payment_method_type not null,
  provider_name text not null, -- e.g. "Wave", "QMoney", "Trust Bank"
  account_name text not null,
  account_number text not null, -- bank account number, or mobile money phone number
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_category_id uuid references public.categories(id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  category_id uuid references public.categories(id),
  title text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status product_status not null default 'active',
  condition product_condition not null default 'new',
  location_city text not null,
  created_at timestamptz not null default now()
);

create table public.product_photos (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  photo_url text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false
);

-- ============================================================
-- CART (v1 — needed for checkout flow)
-- ============================================================
create table public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (buyer_id, product_id)
);

-- ============================================================
-- ORDERS
-- ============================================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.sellers(id),
  status order_status not null default 'placed',
  payment_method payment_method not null,
  seller_payment_method_id uuid references public.seller_payment_methods(id),
  payment_status payment_status not null default 'pending',
  delivery_city text,
  delivery_notes text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  price_at_purchase numeric(12,2) not null
);

-- ============================================================
-- COMMISSIONS / PAYOUTS
-- ============================================================
create table public.commissions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  commission_rate numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  seller_payout_status payout_status not null default 'pending',
  payout_reference text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null unique references public.orders(id),
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.sellers(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REPORTS
-- ============================================================
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.users(id),
  target_type report_target not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ============================================================
-- V2 TABLES (built now, dormant in UI until v2)
-- ============================================================
create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, product_id)
);

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.sellers(id),
  product_id uuid references public.products(id),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_products_seller on public.products(seller_id);
create index idx_products_category on public.products(category_id);
create index idx_products_status on public.products(status);
create index idx_products_location on public.products(location_city);
create index idx_products_price on public.products(price);
create index idx_orders_buyer on public.orders(buyer_id);
create index idx_orders_seller on public.orders(seller_id);
create index idx_order_items_order on public.order_items(order_id);
create index idx_reviews_seller on public.reviews(seller_id);
create index idx_messages_conversation on public.messages(conversation_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.sellers enable row level security;
alter table public.seller_payment_methods enable row level security;
alter table public.products enable row level security;
alter table public.product_photos enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.commissions enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- USERS: users see/edit their own row; admins see all
create policy "users_select_own_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy "users_update_own" on public.users
  for update using (id = auth.uid());
create policy "users_insert_own" on public.users
  for insert with check (id = auth.uid());

-- SELLERS: public can view approved sellers; seller manages own row; admin all
create policy "sellers_select_approved_or_own_or_admin" on public.sellers
  for select using (
    verification_status = 'approved' or id = auth.uid() or public.is_admin()
  );
create policy "sellers_insert_own" on public.sellers
  for insert with check (id = auth.uid());
create policy "sellers_update_own_or_admin" on public.sellers
  for update using (id = auth.uid() or public.is_admin());

-- SELLER PAYMENT METHODS: buyers can see active methods belonging to an
-- approved seller (so they can pick one at checkout); seller manages own;
-- admin sees/manages all.
create policy "seller_payment_methods_select" on public.seller_payment_methods
  for select using (
    (
      is_active = true
      and exists (
        select 1 from public.sellers s
        where s.id = seller_id and s.verification_status = 'approved'
      )
    )
    or seller_id = auth.uid()
    or public.is_admin()
  );
create policy "seller_payment_methods_insert_own" on public.seller_payment_methods
  for insert with check (seller_id = auth.uid());
create policy "seller_payment_methods_update_own_or_admin" on public.seller_payment_methods
  for update using (seller_id = auth.uid() or public.is_admin());
create policy "seller_payment_methods_delete_own_or_admin" on public.seller_payment_methods
  for delete using (seller_id = auth.uid() or public.is_admin());

-- CATEGORIES: public read, admin write
create policy "categories_select_all" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for all using (public.is_admin());

-- PRODUCTS: public can view active products; seller manages own; admin all
create policy "products_select_active_or_own_or_admin" on public.products
  for select using (
    status = 'active' or seller_id = auth.uid() or public.is_admin()
  );
create policy "products_insert_own_seller" on public.products
  for insert with check (
    seller_id = auth.uid()
    and exists (
      select 1 from public.sellers s
      where s.id = auth.uid() and s.verification_status = 'approved'
    )
  );
create policy "products_update_own_or_admin" on public.products
  for update using (seller_id = auth.uid() or public.is_admin());
create policy "products_delete_own_or_admin" on public.products
  for delete using (seller_id = auth.uid() or public.is_admin());

-- PRODUCT PHOTOS: follow product visibility
create policy "product_photos_select" on public.product_photos
  for select using (
    exists (select 1 from public.products p where p.id = product_id
      and (p.status = 'active' or p.seller_id = auth.uid() or public.is_admin()))
  );
create policy "product_photos_write_own_seller" on public.product_photos
  for all using (
    exists (select 1 from public.products p where p.id = product_id
      and (p.seller_id = auth.uid() or public.is_admin()))
  );

-- CART: buyer only sees/edits own cart
create policy "cart_own_only" on public.cart_items
  for all using (buyer_id = auth.uid());

-- ORDERS: buyer sees own orders, seller sees orders for their shop, admin all
create policy "orders_select_participant_or_admin" on public.orders
  for select using (
    buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()
  );
create policy "orders_insert_own_buyer" on public.orders
  for insert with check (buyer_id = auth.uid());
create policy "orders_update_participant_or_admin" on public.orders
  for update using (
    buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()
  );

-- ORDER ITEMS: follow parent order visibility
create policy "order_items_select" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid() or public.is_admin()))
  );
create policy "order_items_insert" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

-- COMMISSIONS: seller sees own, admin sees/manages all — buyers never see this
create policy "commissions_select_own_seller_or_admin" on public.commissions
  for select using (
    public.is_admin() or
    exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid())
  );
create policy "commissions_admin_write" on public.commissions
  for all using (public.is_admin());

-- REVIEWS: public read; only the buyer of a completed order can write
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_own_buyer" on public.reviews
  for insert with check (
    buyer_id = auth.uid() and
    exists (select 1 from public.orders o where o.id = order_id
      and o.buyer_id = auth.uid() and o.status = 'completed')
  );

-- Keep sellers.rating_avg in sync automatically. Runs as the function
-- owner (bypassing RLS) so a buyer leaving a review doesn't need write
-- access to the sellers table themselves.
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

create trigger trg_recalc_seller_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_seller_rating();

-- REPORTS: reporter sees own; admin sees all
create policy "reports_select_own_or_admin" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy "reports_insert_own" on public.reports
  for insert with check (reporter_id = auth.uid());
create policy "reports_update_admin" on public.reports
  for update using (public.is_admin());

-- FAVORITES: buyer only
create policy "favorites_own_only" on public.favorites
  for all using (buyer_id = auth.uid());

-- CONVERSATIONS / MESSAGES: only participants
create policy "conversations_select_participant" on public.conversations
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "conversations_insert_participant" on public.conversations
  for insert with check (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "messages_select_participant" on public.messages
  for select using (
    exists (select 1 from public.conversations c where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
  );
create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid() and
    exists (select 1 from public.conversations c where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
  );

-- ============================================================
-- SEED: starter categories
-- ============================================================
insert into public.categories (name) values
  ('Electronics'), ('Fashion'), ('Home & Kitchen'), ('Beauty & Personal Care'),
  ('Groceries'), ('Phones & Accessories'), ('Vehicles'), ('Property'),
  ('Baby & Kids'), ('Sports & Outdoors');

-- ============================================================
-- STORAGE: product photos bucket
-- Run this after the tables above. Creates a public-read bucket
-- (photos are meant to be visible to all buyers) but only lets a
-- seller upload into their own folder, named by their user id.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "product_photos_public_read" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "product_photos_seller_upload" on storage.objects
  for insert with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "product_photos_seller_delete" on storage.objects
  for delete using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Also create a seller-ID-document bucket — private, only the seller
-- and admins can read (used during verification review).
insert into storage.buckets (id, name, public)
values ('seller-documents', 'seller-documents', false)
on conflict (id) do nothing;

create policy "seller_documents_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "seller_documents_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
