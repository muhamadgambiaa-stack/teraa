begin;

-- Signed-in user and admin RPCs: block anonymous execution.
revoke execute on function public.admin_create_support_answer(text,text,text[],text,boolean,integer,text,boolean,integer) from public, anon;
grant execute on function public.admin_create_support_answer(text,text,text[],text,boolean,integer,text,boolean,integer) to authenticated;

revoke execute on function public.admin_set_support_answer_active(uuid,boolean) from public, anon;
grant execute on function public.admin_set_support_answer_active(uuid,boolean) to authenticated;

revoke execute on function public.admin_update_support_answer(uuid,text,text,text[],text,boolean,integer,text,boolean,integer) from public, anon;
grant execute on function public.admin_update_support_answer(uuid,text,text,text[],text,boolean,integer,text,boolean,integer) to authenticated;

revoke execute on function public.buyer_open_order_conversation(uuid) from public, anon;
grant execute on function public.buyer_open_order_conversation(uuid) to authenticated;

revoke execute on function public.claim_support_thread(uuid) from public, anon;
grant execute on function public.claim_support_thread(uuid) to authenticated;

revoke execute on function public.create_support_thread(text,text,text,uuid) from public, anon;
grant execute on function public.create_support_thread(text,text,text,uuid) to authenticated;

revoke execute on function public.create_support_thread_from_answer(uuid) from public, anon;
grant execute on function public.create_support_thread_from_answer(uuid) to authenticated;

revoke execute on function public.get_order_buyer_for_seller(uuid) from public, anon;
grant execute on function public.get_order_buyer_for_seller(uuid) to authenticated;

revoke execute on function public.get_support_question_menu() from public, anon;
grant execute on function public.get_support_question_menu() to authenticated;

revoke execute on function public.report_order_not_received(uuid) from public, anon;
grant execute on function public.report_order_not_received(uuid) to authenticated;

revoke execute on function public.resolve_support_thread(uuid) from public, anon;
grant execute on function public.resolve_support_thread(uuid) to authenticated;

revoke execute on function public.seller_open_order_conversation(uuid) from public, anon;
grant execute on function public.seller_open_order_conversation(uuid) to authenticated;

revoke execute on function public.send_support_message(uuid,text) from public, anon;
grant execute on function public.send_support_message(uuid,text) to authenticated;

revoke execute on function public.user_request_human_support(uuid) from public, anon;
grant execute on function public.user_request_human_support(uuid) to authenticated;

revoke execute on function public.user_resolve_support_thread(uuid) from public, anon;
grant execute on function public.user_resolve_support_thread(uuid) to authenticated;

-- Internal trigger, cron, and bot helpers are not public RPC endpoints.
revoke execute on function public.close_inactive_bot_support_threads() from public, anon, authenticated;
revoke execute on function public.resolve_delivery_issue_on_completion() from public, anon, authenticated;
revoke execute on function public.recalc_seller_rating() from public, anon, authenticated;
revoke execute on function public.support_bot_match_answer(text,text) from public, anon, authenticated;
revoke execute on function public.support_bot_requests_human(text) from public, anon, authenticated;

-- Fix mutable search-path warning on the rating trigger.
alter function public.recalc_seller_rating() set search_path = '';

-- New functions must receive intentional execution grants.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
