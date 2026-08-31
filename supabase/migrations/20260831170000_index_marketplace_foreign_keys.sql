-- Cover foreign-key columns used by joins, relationship filters and deletes.
-- Teraa is still small enough for normal index creation without meaningful
-- production lock time.

create index if not exists idx_cart_items_product_id
on public.cart_items (product_id);

create index if not exists idx_categories_parent_category_id
on public.categories (parent_category_id);

create index if not exists idx_conversations_product_id
on public.conversations (product_id);

create index if not exists idx_conversations_seller_id
on public.conversations (seller_id);

create index if not exists idx_favorites_product_id
on public.favorites (product_id);

create index if not exists idx_listing_appeals_reviewed_by
on public.listing_appeals (reviewed_by);

create index if not exists idx_messages_sender_id
on public.messages (sender_id);

create index if not exists idx_order_delivery_issues_buyer_id
on public.order_delivery_issues (buyer_id);

create index if not exists idx_order_delivery_issues_seller_id
on public.order_delivery_issues (seller_id);

create index if not exists idx_order_items_product_id
on public.order_items (product_id);

create index if not exists idx_orders_seller_payment_method_id
on public.orders (seller_payment_method_id);

create index if not exists idx_product_photos_product_id
on public.product_photos (product_id);

create index if not exists idx_products_moderated_by
on public.products (moderated_by);

create index if not exists idx_push_subscriptions_user_id
on public.push_subscriptions (user_id);

create index if not exists idx_reports_reporter_id
on public.reports (reporter_id);

create index if not exists idx_reviews_buyer_id
on public.reviews (buyer_id);

create index if not exists idx_seller_payment_methods_seller_id
on public.seller_payment_methods (seller_id);

create index if not exists idx_sellers_status_updated_by
on public.sellers (status_updated_by);

create index if not exists idx_support_messages_sender_id
on public.support_messages (sender_id);

create index if not exists idx_support_threads_assigned_agent_id
on public.support_threads (assigned_agent_id);

create index if not exists idx_support_threads_order_id
on public.support_threads (order_id);

create index if not exists idx_users_restricted_by
on public.users (restricted_by);
