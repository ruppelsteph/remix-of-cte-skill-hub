import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-GROUP-PURCHASE] ${step}${detailsStr}`);
};

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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
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

    // Verify caller is group_admin of this group (or site admin) — defense in depth
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
      }]);

    const purchaseAlreadyExisted = insertErr?.code === "23505";
    if (insertErr && !purchaseAlreadyExisted) {
      throw new Error(`Failed to record purchase: ${insertErr.message}`);
    }
    logStep("Group purchase recorded", { groupId, sessionId, alreadyExisted: purchaseAlreadyExisted });

    // Generate a coupon code tied to this purchase (one per session, idempotent).
    // Format: CLASS-XXXXXX (6 chars, no ambiguous 0/O/1/I).
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

    // Only auto-generate if no code yet exists for this purchase context.
    // Heuristic: skip generation when the session was already recorded earlier.
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
          // Non-collision error: log and stop trying.
          logStep("Coupon insert error", { message: codeErr.message });
          break;
        }
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
