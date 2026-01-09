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

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let priceId = null;

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

    let productName: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];

      const rawPeriodEnd = (subscription as any).current_period_end;
      logStep("Active subscription found", {
        subscriptionId: subscription.id,
        currentPeriodEnd: rawPeriodEnd,
        currentPeriodEndType: typeof rawPeriodEnd,
        itemsCount: subscription.items?.data?.length ?? 0,
      });

      subscriptionEnd = toISOStringFromStripeEpoch(rawPeriodEnd);

      const firstItem = subscription.items?.data?.[0];
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
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      product_name: productName,
      price_id: priceId,
      subscription_end: subscriptionEnd,
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
