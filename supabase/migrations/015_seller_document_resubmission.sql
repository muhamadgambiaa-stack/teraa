-- ============================================================
-- 015_seller_document_resubmission.sql
--
-- Allows sellers to replace their own verification document
-- when resubmitting after rejection.
--
-- Seller can only manage files inside their own folder.
-- Admins retain access for verification.
-- ============================================================


-- ============================================================
-- SELLER DOCUMENT READ
-- ============================================================

drop policy if exists
"seller_documents_owner_or_admin_read"
on storage.objects;

create policy
"seller_documents_owner_or_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'seller-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_is_admin()
  )
);


-- ============================================================
-- SELLER DOCUMENT INSERT
-- ============================================================

drop policy if exists
"seller_documents_owner_upload"
on storage.objects;

create policy
"seller_documents_owner_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'seller-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- SELLER DOCUMENT UPDATE / REPLACEMENT
-- ============================================================
--
-- Needed when upload code uses upsert or replaces an existing
-- document path after verification was rejected.
-- ============================================================

drop policy if exists
"seller_documents_owner_update"
on storage.objects;

create policy
"seller_documents_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'seller-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'seller-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- ADMIN DELETE
-- ============================================================
--
-- Sellers should not freely erase verification evidence after
-- approval. Admins may remove documents when needed.
-- ============================================================

drop policy if exists
"seller_documents_admin_delete"
on storage.objects;

create policy
"seller_documents_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'seller-documents'
  and public.current_user_is_admin()
);