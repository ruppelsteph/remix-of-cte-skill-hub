// Public lookup endpoint for the /join page. Returns minimal information about a
// class coupon code so prospective students can see whether the code is usable
// before they fill out the registration form. Never returns sensitive data.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Best-effort in-memory rate limit (cheap brute-force defense)
type Bucket = { count: number; firstAt: number; blockUntil: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const BLOCK_MS = 5 * 60_000;

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  let b = buckets.get(ip);
  if (b && now < b.blockUntil) return { ok: false, retryAfter: Math.ceil((b.blockUntil - now) / 1000) };
  if (!b || now - b.firstAt > WINDOW_MS) {
    buckets.set(ip, { count: 1, firstAt: now, blockUntil: 0 });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > MAX_PER_WINDOW) {
    b.blockUntil = now + BLOCK_MS;
    return { ok: false, retryAfter: Math.ceil(BLOCK_MS / 1000) };
  }
  return { ok: true };
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  const rl = rateLimit(ip);
  if (!rl.ok) return json(429, { valid: false, reason: "rate_limited" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const url = new URL(req.url);
    const codeRaw = url.searchParams.get("code") ||
      (req.method !== "GET" ? (await req.json().catch(() => ({}))).code : null);
    const code = (codeRaw || "").toString().trim().toUpperCase();
    if (!code || code.length > 64) return json(200, { valid: false, reason: "missing_code" });

    const { data: coupon } = await admin
      .from("group_coupon_codes")
      .select("id, group_id, max_redemptions, redemption_count, expires_at, is_active")
      .eq("code", code)
      .maybeSingle();

    if (!coupon) return json(200, { valid: false, reason: "invalid_code" });
    if (!coupon.is_active) return json(200, { valid: false, reason: "inactive" });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return json(200, { valid: false, reason: "expired" });
    }
    if (coupon.redemption_count >= coupon.max_redemptions) {
      return json(200, { valid: false, reason: "full" });
    }

    // Group name + subscription period, so the student knows what they're joining.
    const [{ data: group }, { data: purchase }] = await Promise.all([
      admin.from("groups").select("name").eq("id", coupon.group_id).maybeSingle(),
      admin.from("group_purchases")
        .select("status, current_period_end")
        .eq("group_id", coupon.group_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return json(200, {
      valid: true,
      groupName: group?.name ?? "Class",
      seatsLeft: coupon.max_redemptions - coupon.redemption_count,
      expiresAt: coupon.expires_at,
      subscriptionStatus: purchase?.status ?? null,
      subscriptionEndsAt: purchase?.current_period_end ?? null,
    });
  } catch (err) {
    return json(500, { valid: false, reason: "error", message: (err as Error).message });
  }
});
