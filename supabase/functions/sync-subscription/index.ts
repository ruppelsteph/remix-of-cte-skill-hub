import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ synced: false, message: "No Stripe customer found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Update profile with stripe_customer_id
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
      expand: ["data.latest_invoice"],
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ synced: false, message: "No active subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const firstItem = subscription.items?.data?.[0];
    const priceId = firstItem?.price?.id ?? null;
    const productId = (firstItem?.price?.product as string) ?? null;

    const toISOStringFromStripeEpoch = (value: unknown): string | null => {
      const n = typeof value === "string" ? Number(value) : (value as number);
      if (!Number.isFinite(n)) return null;

      // Stripe is typically seconds, but some environments can return ms/µs.
      let ms: number;
      if (n < 1e11) ms = n * 1000; // seconds
      else if (n < 1e14) ms = n; // milliseconds
      else if (n < 1e17) ms = Math.floor(n / 1000); // microseconds
      else ms = Math.floor(n / 1e6); // nanoseconds (fallback)

      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    const rawPeriodStart = (subscription as any).current_period_start;
    const rawPeriodEnd = (subscription as any).current_period_end;

    const currentPeriodStart = toISOStringFromStripeEpoch(rawPeriodStart);
    const currentPeriodEnd = toISOStringFromStripeEpoch(rawPeriodEnd);

    logStep("Stripe period fields", {
      rawPeriodStart,
      rawPeriodStartType: typeof rawPeriodStart,
      rawPeriodEnd,
      rawPeriodEndType: typeof rawPeriodEnd,
      currentPeriodStart,
      currentPeriodEnd,
    });

    logStep("Subscription details", {
      subscriptionId: subscription.id,
      priceId,
      productId,
      currentPeriodEnd,
    });

    // Upsert subscription record
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          status: subscription.status,
          price_id: priceId,
          product_id: productId,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "stripe_subscription_id",
        }
      );

    if (subError) {
      logStep("Error upserting subscription", { error: subError.message });
    } else {
      logStep("Subscription upserted successfully");
    }

    // Grant video access for subscribed user (full access to all pathways)
    const { data: pathways } = await supabaseAdmin
      .from("pathways")
      .select("id")
      .eq("is_active", true);

    if (pathways && pathways.length > 0) {
      for (const pathway of pathways) {
        // Check if access already exists
        const { data: existingAccess } = await supabaseAdmin
          .from("video_access")
          .select("id")
          .eq("user_id", user.id)
          .eq("pathway_id", pathway.id)
          .maybeSingle();

        if (!existingAccess) {
          await supabaseAdmin.from("video_access").insert({
            user_id: user.id,
            pathway_id: pathway.id,
            access_type: "subscription",
            expires_at: currentPeriodEnd,
          });
          logStep("Granted pathway access", { pathwayId: pathway.id });
        } else {
          // Update expiration
          await supabaseAdmin
            .from("video_access")
            .update({ expires_at: currentPeriodEnd })
            .eq("id", existingAccess.id);
        }
      }
    }

    // Create order record from the latest invoice
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    if (latestInvoice && typeof latestInvoice === "object") {
      const paymentIntentId = typeof latestInvoice.payment_intent === "string"
        ? latestInvoice.payment_intent
        : latestInvoice.payment_intent?.id;

      // Check if order already exists for this payment intent
      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (!existingOrder && paymentIntentId) {
        const { error: orderError } = await supabaseAdmin.from("orders").insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_checkout_session_id: null,
          amount: latestInvoice.amount_paid ?? 0,
          currency: latestInvoice.currency ?? "usd",
          status: latestInvoice.status === "paid" ? "completed" : "pending",
          product_name: firstItem?.price?.nickname || "Subscription",
        });

        if (orderError) {
          logStep("Error creating order", { error: orderError.message });
        } else {
          logStep("Order created successfully", { paymentIntentId });
        }
      } else {
        logStep("Order already exists or no payment intent", { paymentIntentId });
      }
    }

    return new Response(JSON.stringify({ 
      synced: true, 
      subscription_id: subscription.id,
      message: "Subscription data synced successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
