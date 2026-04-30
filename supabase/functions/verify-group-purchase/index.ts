import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-GROUP-PURCHASE] ${step}${detailsStr}`);
};

// Stripe REST API helpers (no SDK — per project memory)
const STRIPE_BASE = "https://api.stripe.com/v1";

async function stripeGet(path: string, key: string, query?: Record<string, string>): Promise<any> {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  const res = await fetch(`${STRIPE_BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function epochToISO(value: unknown): string | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(n)) return null;
  let ms: number;
  if (n < 1e11) ms = n * 1000;
  else if (n < 1e14) ms = n;
  else ms = Math.floor(n / 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    logStep("Function started");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Retrieve checkout session with subscription expanded
    const session = await stripeGet(
      `/checkout/sessions/${sessionId}`,
      stripeKey,
      { "expand[]": "subscription" },
    );
    logStep("Session retrieved", {
      paymentStatus: session.payment_status,
      status: session.status,
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return new Response(
        JSON.stringify({ recorded: false, reason: "Payment not completed yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const groupId = session.metadata?.group_id;
    const productId = session.metadata?.product_id ?? null;
    const seatCountRaw = Number(session.metadata?.seat_count);
    const seatCount = Number.isFinite(seatCountRaw) && seatCountRaw > 0
      ? Math.min(Math.floor(seatCountRaw), 1000)
      : 25;
    if (!groupId) throw new Error("Session metadata missing group_id");

    // Subscription details from the session
    const subscription = session.subscription;
    const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id ?? null;
    const subStatus = typeof subscription === "object" ? subscription?.status ?? "active" : "active";
    const periodEnd = typeof subscription === "object"
      ? epochToISO(subscription?.current_period_end)
      : null;
    const cancelAtPeriodEnd = typeof subscription === "object"
      ? !!subscription?.cancel_at_period_end
      : false;

    // Verify caller is group_admin of this group (or site admin)
    const { data: membership } = await supabaseAdmin
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRow && membership?.role !== "group_admin") {
      throw new Error("Not authorized to record this group purchase");
    }

    // Idempotent insert — unique(stripe_session_id)
    const { error: insertErr } = await supabaseAdmin
      .from("group_purchases")
      .insert([{
        group_id: groupId,
        stripe_session_id: sessionId,
        product_id: productId,
        stripe_subscription_id: subscriptionId,
        status: subStatus,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        seat_count: seatCount,
      }]);

    const purchaseAlreadyExisted = insertErr?.code === "23505";
    if (insertErr && !purchaseAlreadyExisted) {
      throw new Error(`Failed to record purchase: ${insertErr.message}`);
    }

    // If it already existed, refresh subscription state in case it changed
    if (purchaseAlreadyExisted && subscriptionId) {
      await supabaseAdmin
        .from("group_purchases")
        .update({
          stripe_subscription_id: subscriptionId,
          status: subStatus,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          seat_count: seatCount,
        })
        .eq("stripe_session_id", sessionId);
    }
    logStep("Group purchase recorded", { groupId, sessionId, subscriptionId, periodEnd });

    // Generate a coupon code tied to this purchase (one per session, idempotent).
    const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generateCode = () => {
      let s = "CLASS-";
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
      return s;
    };

    let couponCode: string | null = null;
    let couponId: string | null = null;

    if (!purchaseAlreadyExisted) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode();
        const { data: inserted, error: codeErr } = await supabaseAdmin
          .from("group_coupon_codes")
          .insert([{
            group_id: groupId,
            code: candidate,
            max_redemptions: seatCount,
            created_by: user.id,
          }])
          .select("id, code")
          .single();

        if (!codeErr && inserted) {
          couponCode = inserted.code;
          couponId = inserted.id;
          logStep("Coupon code generated", { couponId, couponCode, seatCount });
          break;
        }
        if (codeErr && codeErr.code !== "23505") {
          logStep("Coupon insert error", { message: codeErr.message });
          break;
        }
      }
    } else {
      // Look up an existing code for this group so the success page can show it.
      const { data: existingCode } = await supabaseAdmin
        .from("group_coupon_codes")
        .select("id, code")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCode) {
        couponCode = existingCode.code;
        couponId = existingCode.id;
      }
    }

    return new Response(
      JSON.stringify({
        recorded: true,
        groupId,
        productId,
        couponCode,
        couponId,
        seatCount,
        currentPeriodEnd: periodEnd,
        subscriptionStatus: subStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
