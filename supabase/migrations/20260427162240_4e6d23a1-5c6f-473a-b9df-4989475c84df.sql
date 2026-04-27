
-- =========================================================
-- 1. group_coupon_codes — lock down SELECT and UPDATE
-- =========================================================

-- Remove the dangerous policy that exposed all coupon codes to any signed-in user.
-- Coupon validation must happen server-side only (register-with-coupon edge fn uses service role).
DROP POLICY IF EXISTS "Authenticated users can look up coupon codes" ON public.group_coupon_codes;

-- Keep "Group admins can view their group codes" (already group-scoped via is_group_admin_of)
-- Add an explicit deny-by-default for everyone else: nothing more is needed since RLS denies by default.

-- Replace the broad UPDATE policy with one that ONLY allows safe column changes.
-- max_redemptions, redemption_count, group_id, created_by, created_at must be immutable from client.
DROP POLICY IF EXISTS "Group admins can update their codes" ON public.group_coupon_codes;

CREATE POLICY "Group admins can update safe fields"
ON public.group_coupon_codes
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.is_group_admin_of(group_id))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_group_admin_of(group_id));

-- Trigger that prevents changes to protected columns from non-service callers.
CREATE OR REPLACE FUNCTION public.protect_coupon_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this check (auth.uid() is null when service_role is used in some flows,
  -- but we also explicitly allow when current_setting('role', true) = 'service_role').
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'group_id is immutable';
  END IF;
  IF NEW.max_redemptions IS DISTINCT FROM OLD.max_redemptions THEN
    RAISE EXCEPTION 'max_redemptions is immutable';
  END IF;
  IF NEW.redemption_count IS DISTINCT FROM OLD.redemption_count THEN
    RAISE EXCEPTION 'redemption_count can only be modified by the server';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_coupon_immutable_fields ON public.group_coupon_codes;
CREATE TRIGGER protect_coupon_immutable_fields
BEFORE UPDATE ON public.group_coupon_codes
FOR EACH ROW
EXECUTE FUNCTION public.protect_coupon_immutable_fields();

-- Also block client-side INSERT of coupon codes (only the server / verify-group-purchase should create).
DROP POLICY IF EXISTS "Group admins can create codes" ON public.group_coupon_codes;
-- (No replacement INSERT policy → only service_role can insert.)


-- =========================================================
-- 2. group_members — no manual student assignment from client
-- =========================================================

-- Replace the policy that let group_admins add students directly.
DROP POLICY IF EXISTS "Group admins can add students; site admins can add anyone" ON public.group_members;

-- Site admins keep INSERT power; group_admin INSERT is removed (server uses service_role).
CREATE POLICY "Site admins can add members"
ON public.group_members
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =========================================================
-- 3. group_purchases — server-only INSERT
-- =========================================================

-- Replace the broad INSERT policy with site-admin-only;
-- the verify-group-purchase edge function uses service_role to record real Stripe purchases.
DROP POLICY IF EXISTS "Group admins and site admins can insert group purchases" ON public.group_purchases;

CREATE POLICY "Site admins can insert group purchases"
ON public.group_purchases
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =========================================================
-- 4. group_coupon_redemptions — already locked down (no INSERT/UPDATE/DELETE policy).
--    SELECT remains: own redemption + group_admin scope. No change needed.
-- =========================================================


-- =========================================================
-- 5. Atomic seat reservation function
-- =========================================================
-- Eliminates race conditions: locks the coupon row, re-checks all conditions,
-- inserts redemption + group_member, increments count — all in one transaction.
CREATE OR REPLACE FUNCTION public.redeem_group_coupon(
  _code text,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon record;
BEGIN
  -- Lock the coupon row to prevent concurrent redemptions racing on the seat count.
  SELECT id, group_id, max_redemptions, redemption_count, expires_at, is_active
    INTO v_coupon
    FROM public.group_coupon_codes
   WHERE code = _code
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inactive');
  END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF v_coupon.redemption_count >= v_coupon.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  -- Already redeemed?
  IF EXISTS (
    SELECT 1 FROM public.group_coupon_redemptions
     WHERE coupon_code_id = v_coupon.id AND user_id = _user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  -- Reserve seat: insert redemption (unique constraint is a second line of defense).
  INSERT INTO public.group_coupon_redemptions (coupon_code_id, group_id, user_id)
  VALUES (v_coupon.id, v_coupon.group_id, _user_id);

  -- Add as student (idempotent on (group_id, user_id) uniqueness if present, otherwise tolerated).
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_coupon.group_id, _user_id, 'student')
  ON CONFLICT DO NOTHING;

  -- Increment count using the locked row.
  UPDATE public.group_coupon_codes
     SET redemption_count = redemption_count + 1
   WHERE id = v_coupon.id;

  RETURN jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'group_id', v_coupon.group_id
  );
END;
$$;

-- Lock down execution: only service_role should call this.
REVOKE ALL ON FUNCTION public.redeem_group_coupon(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_group_coupon(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_group_coupon(text, uuid) TO service_role;
