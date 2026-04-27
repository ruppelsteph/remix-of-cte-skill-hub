
-- =========================================
-- 1. CATEGORIES (hierarchical, bigint PK)
-- =========================================
CREATE TABLE public.categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id BIGINT REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON public.categories(parent_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 2. VIDEOS: add bigint category_id
-- =========================================
ALTER TABLE public.videos
  ADD COLUMN category_id_new BIGINT REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX idx_videos_category_new ON public.videos(category_id_new);

-- Note: we keep the old uuid `category_id` and `pathway_id` columns to avoid breaking
-- existing reads. New code should use `category_id_new`. A follow-up migration can
-- drop them once the frontend is fully migrated.

-- =========================================
-- 3. SUBSCRIPTION ENTITLEMENTS
-- =========================================
CREATE TABLE public.subscription_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('full','category')),
  category_id BIGINT REFERENCES public.categories(id) ON DELETE CASCADE,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month','year')),
  audience TEXT NOT NULL CHECK (audience IN ('individual','group')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entitlement_category_required
    CHECK ((access_type = 'full' AND category_id IS NULL)
        OR (access_type = 'category' AND category_id IS NOT NULL))
);

CREATE INDEX idx_entitlements_price ON public.subscription_entitlements(stripe_price_id);

ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view entitlements"
  ON public.subscription_entitlements FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage entitlements"
  ON public.subscription_entitlements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 4. HELPER FUNCTIONS — category tree
-- =========================================
CREATE OR REPLACE FUNCTION public.category_descendants(_root BIGINT)
RETURNS TABLE(id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT c.id FROM public.categories c WHERE c.id = _root
    UNION ALL
    SELECT c.id FROM public.categories c
      JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree
$$;

CREATE OR REPLACE FUNCTION public.category_ancestors(_leaf BIGINT)
RETURNS TABLE(id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT c.id, c.parent_id FROM public.categories c WHERE c.id = _leaf
    UNION ALL
    SELECT c.id, c.parent_id FROM public.categories c
      JOIN tree t ON c.id = t.parent_id
  )
  SELECT id FROM tree
$$;

-- =========================================
-- 5. ACCESS RESOLVER
-- =========================================
-- Returns true if _user can watch _video based on entitlements, group membership,
-- explicit video_access grants, free/admin status.
CREATE OR REPLACE FUNCTION public.user_has_video_access(_user UUID, _video UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_video record;
  v_ancestors BIGINT[];
BEGIN
  SELECT id, is_active, is_free, category_id_new, pathway_id
    INTO v_video FROM public.videos WHERE id = _video;
  IF NOT FOUND OR v_video.is_active = false THEN RETURN false; END IF;

  -- Free
  IF v_video.is_free THEN RETURN true; END IF;

  -- Admin
  IF _user IS NOT NULL AND public.has_role(_user, 'admin') THEN RETURN true; END IF;
  IF _user IS NULL THEN RETURN false; END IF;

  -- Explicit grant
  IF EXISTS (
    SELECT 1 FROM public.video_access va
     WHERE va.user_id = _user
       AND (va.expires_at IS NULL OR va.expires_at > now())
       AND (va.video_id = _video OR (v_video.pathway_id IS NOT NULL AND va.pathway_id = v_video.pathway_id))
  ) THEN RETURN true; END IF;

  -- Resolve ancestors of the video's category (including itself)
  IF v_video.category_id_new IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ancestors
      FROM public.category_ancestors(v_video.category_id_new);
  END IF;

  -- Individual subscription: full or category access
  IF EXISTS (
    SELECT 1
      FROM public.subscriptions s
      JOIN public.subscription_entitlements e
        ON e.stripe_price_id = s.price_id
     WHERE s.user_id = _user
       AND s.status IN ('active','trialing')
       AND e.audience = 'individual'
       AND (
         e.access_type = 'full'
         OR (e.access_type = 'category' AND e.category_id = ANY(COALESCE(v_ancestors, ARRAY[]::BIGINT[])))
       )
  ) THEN RETURN true; END IF;

  -- Group access: any group the user belongs to has a group purchase whose product/price
  -- maps to a group entitlement that grants full or matching-category access.
  IF EXISTS (
    SELECT 1
      FROM public.group_members gm
      JOIN public.group_purchases gp ON gp.group_id = gm.group_id
      JOIN public.subscription_entitlements e
        ON e.stripe_price_id = gp.product_id
     WHERE gm.user_id = _user
       AND e.audience = 'group'
       AND (
         e.access_type = 'full'
         OR (e.access_type = 'category' AND e.category_id = ANY(COALESCE(v_ancestors, ARRAY[]::BIGINT[])))
       )
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- =========================================
-- 6. REPLACE video_sources RLS to use the resolver
-- =========================================
DROP POLICY IF EXISTS "View video sources with access" ON public.video_sources;

CREATE POLICY "View video sources with access"
  ON public.video_sources FOR SELECT
  USING (public.user_has_video_access(auth.uid(), video_id));
