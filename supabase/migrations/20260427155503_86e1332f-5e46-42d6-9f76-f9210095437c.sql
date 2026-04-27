-- Helper: returns true if the user belongs to a group that has at least one group purchase
CREATE OR REPLACE FUNCTION public.user_has_group_purchase_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.group_purchases gp ON gp.group_id = gm.group_id
    WHERE gm.user_id = _user_id
  )
$$;

-- Replace the existing video_sources SELECT policy with one that also honors group purchases
DROP POLICY IF EXISTS "View video sources with access" ON public.video_sources;

CREATE POLICY "View video sources with access"
ON public.video_sources
FOR SELECT
USING (
  -- Free, active videos
  EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id = video_sources.video_id
      AND v.is_active = true
      AND v.is_free = true
  )
  OR
  -- Site admins
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Active or trialing individual subscribers
  EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.status IN ('active', 'trialing')
  )
  OR
  -- Explicit per-video or per-pathway access grant (not expired)
  EXISTS (
    SELECT 1
    FROM public.video_access va
    JOIN public.videos v ON v.id = video_sources.video_id
    WHERE va.user_id = auth.uid()
      AND (va.expires_at IS NULL OR va.expires_at > now())
      AND (
        va.video_id = video_sources.video_id
        OR va.pathway_id = v.pathway_id
      )
  )
  OR
  -- Member of a group that has a group purchase
  public.user_has_group_purchase_access(auth.uid())
);