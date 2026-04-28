DROP INDEX IF EXISTS public.videos_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS videos_slug_unique ON public.videos (slug);