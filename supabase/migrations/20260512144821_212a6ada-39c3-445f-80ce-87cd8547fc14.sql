CREATE OR REPLACE FUNCTION public.user_has_video_access(_user uuid, _video uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_video record;
  v_ancestors BIGINT[];
BEGIN
  SELECT id, is_active, is_free, category_id_new, pathway_id
    INTO v_video FROM public.videos WHERE id = _video;
  IF NOT FOUND OR v_video.is_active = false THEN RETURN false; END IF;

  IF v_video.is_free THEN RETURN true; END IF;

  IF _user IS NOT NULL AND public.has_role(_user, 'admin') THEN RETURN true; END IF;
  IF _user IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.video_access va
     WHERE va.user_id = _user
       AND (va.expires_at IS NULL OR va.expires_at > now())
       AND (va.video_id = _video OR (v_video.pathway_id IS NOT NULL AND va.pathway_id = v_video.pathway_id))
  ) THEN RETURN true; END IF;

  IF v_video.category_id_new IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ancestors
      FROM public.category_ancestors(v_video.category_id_new);
  END IF;

  -- Individual subscription: full or category access. Require period not expired.
  IF EXISTS (
    SELECT 1
      FROM public.subscriptions s
      JOIN public.subscription_entitlements e
        ON e.stripe_price_id = s.price_id
     WHERE s.user_id = _user
       AND s.status IN ('active','trialing')
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
       AND e.audience = 'individual'
       AND (
         e.access_type = 'full'
         OR (e.access_type = 'category' AND e.category_id = ANY(COALESCE(v_ancestors, ARRAY[]::BIGINT[])))
       )
  ) THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.group_members gm
      JOIN public.group_purchases gp
        ON gp.group_id = gm.group_id
       AND gp.status IN ('active','trialing')
       AND (gp.current_period_end IS NULL OR gp.current_period_end > now())
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
$function$;