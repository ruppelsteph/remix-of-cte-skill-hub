
REVOKE EXECUTE ON FUNCTION public.category_descendants(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.category_ancestors(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_video_access(UUID, UUID) FROM PUBLIC, anon, authenticated;
