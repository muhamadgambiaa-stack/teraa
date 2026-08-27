-- ============================================================
-- MIGRATION 033
-- HARDEN STORAGE BUCKET UPLOAD LIMITS
-- ============================================================

-- Product images: maximum 5 MB, images only
update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
where id = 'product-photos';


-- Seller verification documents:
-- maximum 10 MB, common image formats or PDF
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
where id = 'seller-documents';