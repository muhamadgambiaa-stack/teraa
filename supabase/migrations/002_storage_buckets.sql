-- ============================================================
-- MIGRATION 002: storage buckets for product photos & seller docs
-- Run this in Supabase SQL Editor if you already ran schema.sql
-- before this file existed. Safe to run more than once.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "product_photos_public_read" on storage.objects;
create policy "product_photos_public_read" on storage.objects
  for select using (bucket_id = 'product-photos');

drop policy if exists "product_photos_seller_upload" on storage.objects;
create policy "product_photos_seller_upload" on storage.objects
  for insert with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_photos_seller_delete" on storage.objects;
create policy "product_photos_seller_delete" on storage.objects
  for delete using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

insert into storage.buckets (id, name, public)
values ('seller-documents', 'seller-documents', false)
on conflict (id) do nothing;

drop policy if exists "seller_documents_owner_or_admin_read" on storage.objects;
create policy "seller_documents_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "seller_documents_owner_upload" on storage.objects;
create policy "seller_documents_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
