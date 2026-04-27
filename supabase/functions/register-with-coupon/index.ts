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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    log("Validating coupon", { code });

    // 1. Look up coupon
    const { data: coupon, error: couponErr } = await admin
      .from("group_coupon_codes")
      .select("id, group_id, max_redemptions, redemption_count, expires_at, is_active")
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

    // 2. Check if email already redeemed this code
    const { data: existingUser } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser?.user_id) {
      const { data: prior } = await admin
        .from("group_coupon_redemptions")
        .select("id")
        .eq("coupon_code_id", coupon.id)
        .eq("user_id", existingUser.user_id)
        .maybeSingle();
      if (prior) {
        return json(400, { error: "You have already redeemed this coupon code." });
      }
    }

    log("Coupon valid, creating user");

    // 3. Create user via admin API (email_confirm=false → verification email is sent)
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

    // 4. Insert redemption first (unique constraint protects against double-claim)
    const { error: redErr } = await admin.from("group_coupon_redemptions").insert({
      coupon_code_id: coupon.id,
      group_id: coupon.group_id,
      user_id: createdUserId,
    });
    if (redErr) {
      log("Redemption insert failed", { error: redErr.message });
      throw new Error("Could not record coupon redemption.");
    }

    // 5. Insert group membership as student
    const { error: memErr } = await admin.from("group_members").insert({
      group_id: coupon.group_id,
      user_id: createdUserId,
      role: "student",
    });
    if (memErr && !/duplicate|unique/i.test(memErr.message)) {
      log("Group member insert failed", { error: memErr.message });
      throw new Error("Could not add you to the group.");
    }

    // 6. Increment redemption_count atomically
    const { error: incErr } = await admin
      .from("group_coupon_codes")
      .update({ redemption_count: coupon.redemption_count + 1 })
      .eq("id", coupon.id)
      .lt("redemption_count", coupon.max_redemptions);

    if (incErr) {
      log("Increment failed", { error: incErr.message });
      throw new Error("Could not finalize coupon redemption.");
    }

    log("Registration complete", { userId: createdUserId, groupId: coupon.group_id });

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

    return json(500, { error: message });
  }
});
