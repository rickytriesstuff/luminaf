-- Keep social content and conversations inaccessible to anonymous API roles.
revoke all on table public.social_posts, public.social_likes, public.social_comments, public.social_messages from anon;
grant select, insert, delete on table public.social_posts to authenticated;
grant select, insert, delete on table public.social_likes to authenticated;
grant select, insert, delete on table public.social_comments to authenticated;
grant select, insert on table public.social_messages to authenticated;
revoke update on table public.social_messages from authenticated;
grant update (read_at) on table public.social_messages to authenticated;