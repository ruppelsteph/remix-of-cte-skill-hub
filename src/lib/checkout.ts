import { supabase } from "@/integrations/supabase/client";

/**
 * Start a Stripe checkout for an individual subscription price.
 * If the user is not signed in, sends them to /auth with a redirect back.
 * Returns true if a redirect was initiated, false on failure (caller can toast).
 */
export async function startCategoryCheckout(
  priceId: string,
  returnPath: string
): Promise<{ ok: true } | { ok: false; error: string } | { ok: false; redirected: true }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const url = `/auth?mode=signup&redirect=${encodeURIComponent(returnPath)}`;
    window.location.href = url;
    return { ok: false, redirected: true };
  }
  try {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url as string;
      return { ok: true };
    }
    return { ok: false, error: "No checkout URL returned" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkout failed" };
  }
}
