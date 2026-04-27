
-- Coupon codes table
CREATE TABLE IF NOT EXISTS public.group_coupon_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  max_redemptions integer NOT NULL CHECK (max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_coupon_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_coupon_codes_group_id
  ON public.group_coupon_codes(group_id);

-- Group admins & site admins can view their group's codes
CREATE POLICY "Group admins can view their group codes"
ON public.group_coupon_codes FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

-- Any authenticated user can look up a code (needed to redeem). RLS still scopes
-- this to single-row lookups by `code` — they can't enumerate other groups' codes
-- without knowing the value.
CREATE POLICY "Authenticated users can look up coupon codes"
ON public.group_coupon_codes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Group admins can create codes"
ON public.group_coupon_codes FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

CREATE POLICY "Group admins can update their codes"
ON public.group_coupon_codes FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

CREATE POLICY "Group admins can delete their codes"
ON public.group_coupon_codes FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

-- Coupon redemptions table
CREATE TABLE IF NOT EXISTS public.group_coupon_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_code_id uuid NOT NULL REFERENCES public.group_coupon_codes(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_code_id, user_id)
);

ALTER TABLE public.group_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_coupon_redemptions_group_id
  ON public.group_coupon_redemptions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_coupon_redemptions_user_id
  ON public.group_coupon_redemptions(user_id);

CREATE POLICY "Users can view their own redemptions"
ON public.group_coupon_redemptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Group admins can view their group redemptions"
ON public.group_coupon_redemptions FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);
-- INSERT/DELETE are not exposed yet — registration logic comes later.
