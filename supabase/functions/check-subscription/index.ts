import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Fetch all subscriptions (active or trialing) to pick the most relevant one
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
    });

    // Filter to active/trialing subscriptions and pick the one with latest current_period_end
    const relevantStatuses = ["active", "trialing"];
    const relevantSubs = subscriptions.data.filter((sub: { status: string }) =>
      relevantStatuses.includes(sub.status)
    );

    logStep("Fetched subscriptions", {
      total: subscriptions.data.length,
      relevant: relevantSubs.length,
    });

    // deno-lint-ignore no-explicit-any
    let selectedSubscription: any = null;
    if (relevantSubs.length > 0) {
      // Pick the one with the latest current_period_end
      // deno-lint-ignore no-explicit-any
      selectedSubscription = relevantSubs.reduce((best: any, current: any) => {
        const bestEnd = best.current_period_end ?? 0;
        const currentEnd = current.current_period_end ?? 0;
        return currentEnd > bestEnd ? current : best;
      });
    }

    const hasActiveSub = selectedSubscription !== null;
    let productId = null;
    let subscriptionEnd: string | null = null;
    let subscriptionEndUnix: number | null = null;
    let priceId = null;
    let productName: string | null = null;
    let subscriptionStatus: string | null = null;

    if (hasActiveSub && selectedSubscription) {
      subscriptionStatus = selectedSubscription.status;

      // Stripe returns Unix timestamps (seconds). Use only current_period_end for renewal date.
      const periodEndSeconds = (selectedSubscription as any).current_period_end ?? null;

      if (typeof periodEndSeconds === "number" && Number.isFinite(periodEndSeconds)) {
        subscriptionEndUnix = periodEndSeconds;
        subscriptionEnd = new Date(periodEndSeconds * 1000).toISOString();
      } else {
        subscriptionEnd = null;
        subscriptionEndUnix = null;
      }

      logStep("Selected subscription", {
        subscriptionId: selectedSubscription.id,
        status: subscriptionStatus,
        currentPeriodEnd: periodEndSeconds,
        subscriptionEnd,
        itemsCount: selectedSubscription.items?.data?.length ?? 0,
      });

      const firstItem = selectedSubscription.items?.data?.[0];
      productId = (firstItem?.price?.product as string) ?? null;
      priceId = firstItem?.price?.id ?? null;

      // Fetch product name from Stripe
      if (productId) {
        try {
          const product = await stripe.products.retrieve(productId);
          productName = product.name ?? null;
          logStep("Fetched product name", { productId, productName });
        } catch (e) {
          logStep("Error fetching product", { error: (e as Error).message });
        }
      }

      logStep("Determined subscription tier", { productId, priceId, productName, subscriptionEnd });
    } else {
      logStep("No active or trialing subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_status: subscriptionStatus,
      product_id: productId,
      product_name: productName,
      price_id: priceId,
      subscription_end: subscriptionEnd,
      subscription_end_unix: subscriptionEndUnix,
      stripe_customer_id: customerId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
