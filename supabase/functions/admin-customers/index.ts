import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-CUSTOMERS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Access denied: Admin privileges required");
    }
    logStep("Admin access verified");

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const email = url.searchParams.get("email");
    
    logStep("Fetching customers", { limit, email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const listParams: Stripe.CustomerListParams = { limit };
    if (email) listParams.email = email;

    const customers = await stripe.customers.list(listParams);
    logStep("Customers fetched", { count: customers.data.length });

    // Get subscription info for each customer
    const customersWithSubscriptions = await Promise.all(
      customers.data.map(async (customer: Stripe.Customer) => {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 1,
        });
        
        const charges = await stripe.charges.list({
          customer: customer.id,
          limit: 10,
        });

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: customer.created,
          subscription: subscriptions.data[0] ? {
            id: subscriptions.data[0].id,
            status: subscriptions.data[0].status,
            current_period_end: subscriptions.data[0].current_period_end,
            cancel_at_period_end: subscriptions.data[0].cancel_at_period_end,
          } : null,
          charges: charges.data.map((c: Stripe.Charge) => ({
            id: c.id,
            amount: c.amount,
            currency: c.currency,
            status: c.status,
            refunded: c.refunded,
            payment_intent: c.payment_intent,
            created: c.created,
          })),
        };
      })
    );

    return new Response(JSON.stringify({ customers: customersWithSubscriptions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in admin-customers", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
