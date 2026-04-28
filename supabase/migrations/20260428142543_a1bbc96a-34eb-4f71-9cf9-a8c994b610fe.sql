GRANT EXECUTE ON FUNCTION public.user_has_video_access(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.category_ancestors(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.category_descendants(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;