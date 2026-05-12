import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-GROUP-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Anon client for verifying the caller
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  // Service role for trusted writes (creating group, granting role)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    logStep("Function started");

    const body = await req.json();
    const priceId: string | undefined = body?.priceId;
    const groupName: string | undefined = body?.groupName?.toString().trim();
    const rawSeats = Number(body?.seatCount);
    const seatCount = Number.isFinite(rawSeats) && rawSeats > 0
      ? Math.min(Math.floor(rawSeats), 1000)
      : 25;
    if (!priceId) throw new Error("priceId is required");
    if (!groupName) throw new Error("groupName is required");
    logStep("Inputs received", { priceId, groupName, seatCount });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // Find or create the user's group. If they're already a group_admin of one, reuse it.
    let groupId: string | null = null;
    {
      const { data: existingMembership } = await supabaseAdmin
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("role", "group_admin")
        .maybeSingle();

      if (existingMembership?.group_id) {
        groupId = existingMembership.group_id as string;
        // Update name if it differs
        await supabaseAdmin
          .from("groups")
          .update({ name: groupName })
          .eq("id", groupId);
        logStep("Reusing existing group", { groupId });
      }
    }

    if (!groupId) {
      // Grant group_admin role; the DB trigger will create a group + membership + sync profile.
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert([{ user_id: user.id, role: "group_admin" }]);
      // Ignore unique-violation: role may already exist; trigger only fires on insert,
      // so we still need to create a group manually if it didn't.
      if (roleError && roleError.code !== "23505") {
        throw new Error(`Failed to grant group_admin role: ${roleError.message}`);
      }

      // Re-check membership (trigger should have created it)
      const { data: refreshed } = await supabaseAdmin
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("role", "group_admin")
        .maybeSingle();

      if (refreshed?.group_id) {
        groupId = refreshed.group_id as string;
        await supabaseAdmin
          .from("groups")
          .update({ name: groupName })
          .eq("id", groupId);
      } else {
        // Fallback: create group manually
        const { data: newGroup, error: groupErr } = await supabaseAdmin
          .from("groups")
          .insert([{ name: groupName, created_by: user.id }])
          .select("id")
          .single();
        if (groupErr || !newGroup) throw new Error(`Failed to create group: ${groupErr?.message}`);
        groupId = newGroup.id;

        await supabaseAdmin
          .from("group_members")
          .insert([{ group_id: groupId, user_id: user.id, role: "group_admin" }]);

        await supabaseAdmin
          .from("profiles")
          .update({ role: "group_admin", group_id: groupId })
          .eq("user_id", user.id);
      }
      logStep("Group ready", { groupId });
    }

    // Stripe checkout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    // Look up product id from the price (so we can persist it later)
    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === "string" ? price.product : price.product.id;

    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/account?group_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        group_id: groupId!,
        price_id: priceId,
        product_id: productId,
        purchase_type: "group",
        seat_count: String(seatCount),
      },
      subscription_data: {
        metadata: {
          group_id: groupId!,
          price_id: priceId,
          product_id: productId,
          purchase_type: "group",
          seat_count: String(seatCount),
        },
      },
    });
    logStep("Checkout session created", { sessionId: session.id, groupId });

    return new Response(JSON.stringify({ url: session.url, groupId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
