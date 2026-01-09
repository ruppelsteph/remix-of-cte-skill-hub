import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Native fetch helper for Stripe API
async function stripeRequest(endpoint: string, stripeKey: string): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
}

interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      price: {
        id: string;
        product: string;
      };
    }>;
  };
}

interface StripeCustomer {
  id: string;
  email: string;
}

interface StripeProduct {
  id: string;
  name: string;
}

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

    // Check if stripe_customer_id exists in profiles table first
    let stripeCustomerId: string | null = null;
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (profileData?.stripe_customer_id) {
      stripeCustomerId = profileData.stripe_customer_id;
      logStep("Found stripe_customer_id from profile", { stripeCustomerId });
    } else {
      // Look up customer by email via Stripe API
      const customersRes = await stripeRequest(
        `/customers?email=${encodeURIComponent(user.email)}&limit=1`,
        stripeKey
      );
      
      if (!customersRes.ok) {
        const errorText = await customersRes.text();
        throw new Error(`Stripe customers API error: ${errorText}`);
      }
      
      const customersData = await customersRes.json();
      const customers: StripeCustomer[] = customersData.data || [];
      
      if (customers.length === 0) {
        logStep("No customer found, returning unsubscribed state");
        return new Response(JSON.stringify({ 
          subscribed: false,
          status: "none",
          subscription_status: null,
          current_period_end_iso: null,
          current_period_end_unix: null
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      stripeCustomerId = customers[0].id;
      logStep("Found Stripe customer via email lookup", { stripeCustomerId });
    }

    // Fetch subscriptions using native fetch
    const subsRes = await stripeRequest(
      `/subscriptions?customer=${stripeCustomerId}&status=all&limit=10`,
      stripeKey
    );
    
    if (!subsRes.ok) {
      const errorText = await subsRes.text();
      throw new Error(`Stripe subscriptions API error: ${errorText}`);
    }
    
    const subsData = await subsRes.json();
    const subscriptions: StripeSubscription[] = subsData.data || [];

    logStep("Fetched subscriptions", { total: subscriptions.length });

    // Filter to active/trialing subscriptions and pick the one with latest current_period_end
    const relevantStatuses = ["active", "trialing"];
    const relevantSubs = subscriptions.filter((sub) =>
      relevantStatuses.includes(sub.status)
    );

    logStep("Filtered subscriptions", {
      total: subscriptions.length,
      relevant: relevantSubs.length,
    });

    let selectedSubscription: StripeSubscription | null = null;
    if (relevantSubs.length > 0) {
      // Pick the one with the latest current_period_end
      selectedSubscription = relevantSubs.reduce((best, current) => {
        const bestEnd = best.current_period_end ?? 0;
        const currentEnd = current.current_period_end ?? 0;
        return currentEnd > bestEnd ? current : best;
      });
    }

    // If no active/trialing, return none status
    if (!selectedSubscription) {
      logStep("No active or trialing subscription found");
      return new Response(JSON.stringify({
        subscribed: false,
        status: "none",
        subscription_status: null,
        stripe_customer_id: stripeCustomerId,
        subscription_id: null,
        cancel_at_period_end: null,
        current_period_end_unix: null,
        current_period_end_iso: null,
        product_id: null,
        product_name: null,
        price_id: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Extract subscription details
    const periodEndSeconds = selectedSubscription.current_period_end;
    const subscriptionEndUnix = typeof periodEndSeconds === "number" && Number.isFinite(periodEndSeconds)
      ? periodEndSeconds
      : null;
    const subscriptionEnd = subscriptionEndUnix
      ? new Date(subscriptionEndUnix * 1000).toISOString()
      : null;

    logStep("Selected subscription", {
      subscriptionId: selectedSubscription.id,
      status: selectedSubscription.status,
      currentPeriodEnd: periodEndSeconds,
      subscriptionEnd,
    });

    const firstItem = selectedSubscription.items?.data?.[0];
    const productId = firstItem?.price?.product ?? null;
    const priceId = firstItem?.price?.id ?? null;

    // Fetch product name from Stripe via native fetch
    let productName: string | null = null;
    if (productId) {
      try {
        const productRes = await stripeRequest(`/products/${productId}`, stripeKey);
        if (productRes.ok) {
          const product: StripeProduct = await productRes.json();
          productName = product.name ?? null;
          logStep("Fetched product name", { productId, productName });
        }
      } catch (e) {
        logStep("Error fetching product", { error: (e as Error).message });
      }
    }

    logStep("Returning subscription data", { 
      productId, 
      priceId, 
      productName, 
      subscriptionEnd,
      status: selectedSubscription.status
    });

    return new Response(JSON.stringify({
      subscribed: true,
      status: selectedSubscription.status,
      subscription_status: selectedSubscription.status,
      stripe_customer_id: stripeCustomerId,
      subscription_id: selectedSubscription.id,
      cancel_at_period_end: selectedSubscription.cancel_at_period_end,
      current_period_end_unix: subscriptionEndUnix,
      current_period_end_iso: subscriptionEnd,
      subscription_end: subscriptionEnd,
      subscription_end_unix: subscriptionEndUnix,
      product_id: productId,
      product_name: productName,
      price_id: priceId
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
