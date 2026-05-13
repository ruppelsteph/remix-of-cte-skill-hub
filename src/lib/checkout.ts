import { supabase } from "@/integrations/supabase/client";

/**
 * Start a Stripe checkout for an individual subscription price.
 * If the user is not signed in, sends them to /auth with a redirect back
 * (returns null — caller should NOT show an error in that case).
 * Returns null on success/redirect, or an error string on failure.
 */
export async function startCategoryCheckout(
  priceId: string,
  returnPath: string
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `/auth?mode=signup&redirect=${encodeURIComponent(returnPath)}`;
    return null;
  }
  try {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url as string;
      return null;
    }
    return "No checkout URL returned";
  } catch (e) {
    return e instanceof Error ? e.message : "Checkout failed";
  }
}
