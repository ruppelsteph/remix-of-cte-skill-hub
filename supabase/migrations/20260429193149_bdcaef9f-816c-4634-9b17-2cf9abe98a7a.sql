ALTER TABLE public.video_sources DROP CONSTRAINT IF EXISTS video_sources_video_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS video_sources_video_id_kind_key
ON public.video_sources (video_id, kind);