
-- 1. Create the protected video_sources table
CREATE TABLE public.video_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES public.videos(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_sources_video_id ON public.video_sources(video_id);

-- 2. Migrate existing URLs
INSERT INTO public.video_sources (video_id, video_url)
SELECT id, video_url
FROM public.videos
WHERE video_url IS NOT NULL AND video_url <> '';

-- 3. Drop the now-redundant column on videos
ALTER TABLE public.videos DROP COLUMN video_url;

-- 4. Updated-at trigger
CREATE TRIGGER update_video_sources_updated_at
BEFORE UPDATE ON public.video_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.video_sources ENABLE ROW LEVEL SECURITY;

-- 6. SELECT policy: free videos OR active subscriber OR explicit access OR admin
CREATE POLICY "View video sources with access"
ON public.video_sources
FOR SELECT
USING (
  -- Free videos: anyone can read the URL
  EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id = video_sources.video_id
      AND v.is_active = true
      AND v.is_free = true
  )
  OR
  -- Admins
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Active/trialing subscribers
  EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.status IN ('active', 'trialing')
  )
  OR
  -- Explicit per-video or per-pathway access grant (not expired)
  EXISTS (
    SELECT 1 FROM public.video_access va
    JOIN public.videos v ON v.id = video_sources.video_id
    WHERE va.user_id = auth.uid()
      AND (va.expires_at IS NULL OR va.expires_at > now())
      AND (
        va.video_id = video_sources.video_id
        OR va.pathway_id = v.pathway_id
      )
  )
);

-- 7. Admin write policies (only admins manage source URLs directly;
--    code paths that insert videos should also insert video_sources via the same auth context)
CREATE POLICY "Admins can insert video sources"
ON public.video_sources
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update video sources"
ON public.video_sources
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete video sources"
ON public.video_sources
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));
