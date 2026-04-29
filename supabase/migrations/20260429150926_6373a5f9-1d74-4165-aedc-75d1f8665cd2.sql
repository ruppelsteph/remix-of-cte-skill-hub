CREATE POLICY "Admins can view all video sources"
ON public.video_sources
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));