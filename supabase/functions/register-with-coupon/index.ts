import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REGISTER-WITH-COUPON] ${step}${d}`);
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---- In-memory rate limiter (best-effort; resets when the isolate restarts) ----
// Caps brute-force attempts at the coupon validation endpoint per client IP.
type Bucket = { count: number; firstAt: number; blockUntil: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;          // 1 minute window
const MAX_ATTEMPTS_PER_WINDOW = 10; // 10 attempts / IP / minute
const BLOCK_MS = 10 * 60_000;       // 10 minute block when exceeded

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";
}

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  let b = buckets.get(ip);

  // Periodically prune (cheap)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.firstAt > WINDOW_MS && now > v.blockUntil) buckets.delete(k);
    }
  }

  if (b && now < b.blockUntil) {
    return { ok: false, retryAfter: Math.ceil((b.blockUntil - now) / 1000) };
  }
  if (!b || now - b.firstAt > WINDOW_MS) {
    b = { count: 1, firstAt: now, blockUntil: 0 };
    buckets.set(ip, b);
    return { ok: true };
  }
  b.count += 1;
  if (b.count > MAX_ATTEMPTS_PER_WINDOW) {
    b.blockUntil = now + BLOCK_MS;
    return { ok: false, retryAfter: Math.ceil(BLOCK_MS / 1000) };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit BEFORE doing any work
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    log("Rate limited", { ip, retryAfter: rl.retryAfter });
    return new Response(
      JSON.stringify({ error: "Too many attempts. Please try again later." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter ?? 60),
        },
      },
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let createdUserId: string | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid request body" });

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: "A valid email is required." });
    }
    if (!password || password.length < 6) {
      return json(400, { error: "Password must be at least 6 characters." });
    }
    if (!fullName) return json(400, { error: "Full name is required." });
    if (!code) return json(400, { error: "Coupon code is required." });
    if (code.length > 64) return json(400, { error: "Coupon code is invalid." });

    // ---- Cheap pre-check: does the code exist & look valid? ----
    // (Final, authoritative check happens atomically inside redeem_group_coupon below.)
    const { data: coupon, error: couponErr } = await admin
      .from("group_coupon_codes")
      .select("id, is_active, expires_at, max_redemptions, redemption_count")
      .eq("code", code)
      .maybeSingle();

    if (couponErr) {
      log("Coupon lookup error", { error: couponErr.message });
      return json(500, { error: "Could not validate coupon. Please try again." });
    }
    if (!coupon) return json(400, { error: "Invalid coupon code." });
    if (!coupon.is_active) return json(400, { error: "This coupon code is no longer active." });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return json(400, { error: "This coupon code has expired." });
    }
    if (coupon.redemption_count >= coupon.max_redemptions) {
      return json(400, { error: "This coupon code has reached its redemption limit." });
    }

    log("Coupon pre-check passed, creating user");

    // Create user via admin API (email_confirm=false → verification email is sent)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      log("User creation failed", { error: createErr?.message });
      const msg = createErr?.message || "Could not create account.";
      const isDup = /already|registered|exists/i.test(msg);
      return json(400, { error: isDup ? "An account with this email already exists." : msg });
    }

    createdUserId = created.user.id;
    log("User created", { userId: createdUserId });

    // Trigger send of verification email
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });
    if (linkErr) log("generateLink note", { error: linkErr.message });

    // ---- ATOMIC redemption: locks the coupon row, re-verifies, inserts redemption + member,
    // and increments the count — all in one transaction. No race conditions on seat usage.
    const { data: rpcResult, error: rpcErr } = await admin.rpc("redeem_group_coupon", {
      _code: code,
      _user_id: createdUserId,
    });

    if (rpcErr) {
      log("RPC error", { error: rpcErr.message });
      throw new Error("Could not finalize coupon redemption.");
    }

    const result = rpcResult as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      const reason = result?.error ?? "unknown";
      log("Redemption rejected", { reason });
      const userMsg: Record<string, string> = {
        invalid_code: "Invalid coupon code.",
        inactive: "This coupon code is no longer active.",
        expired: "This coupon code has expired.",
        full: "This coupon code has reached its redemption limit.",
        already_redeemed: "You have already redeemed this coupon code.",
      };
      throw new Error(userMsg[reason] ?? "Could not redeem coupon.");
    }

    log("Registration complete", { userId: createdUserId });

    return json(200, {
      success: true,
      message: "Account created. Please check your email to verify your account.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log("ERROR", { message });

    // Best-effort rollback if we created the user but later steps failed
    if (createdUserId) {
      try {
        await admin.auth.admin.deleteUser(createdUserId);
        log("Rolled back user creation");
      } catch (rollbackErr) {
        log("Rollback failed", {
          error: rollbackErr instanceof Error ? rollbackErr.message : "unknown",
        });
      }
    }

    return json(400, { error: message });
  }
});
