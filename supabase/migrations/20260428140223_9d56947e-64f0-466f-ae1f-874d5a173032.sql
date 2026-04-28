
-- 1. Add slug to videos
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS videos_slug_unique ON public.videos(slug) WHERE slug IS NOT NULL;

-- 2. Add is_preview and kind to video_sources
ALTER TABLE public.video_sources ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.video_sources ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other';

-- 3. Replace SELECT policy on video_sources to allow public access for previews
DROP POLICY IF EXISTS "View video sources with access" ON public.video_sources;

CREATE POLICY "View preview sources publicly"
ON public.video_sources
FOR SELECT
USING (
  is_preview = true
  AND EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_sources.video_id AND v.is_active = true)
);

CREATE POLICY "View full sources with access"
ON public.video_sources
FOR SELECT
USING (
  is_preview = false
  AND public.user_has_video_access(auth.uid(), video_id)
);
