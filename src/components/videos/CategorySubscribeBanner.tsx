import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PriceLike {
  stripe_price_id: string;
  unit_amount: number | null;
  currency: string | null;
}

interface Props {
  categoryName: string;
  monthly?: PriceLike;
  yearly?: PriceLike;
  hasAccess: boolean;
  loadingPriceId: string | null;
  onCheckout: (priceId: string) => void;
}

const fmt = (cents: number | null, currency: string | null) => {
  if (cents == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

export function CategorySubscribeBanner({
  categoryName,
  monthly,
  yearly,
  hasAccess,
  loadingPriceId,
  onCheckout,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (hasAccess) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium">
          You have access to {categoryName}. Enjoy the full library.
        </span>
      </div>
    );
  }

  if (dismissed || (!monthly && !yearly)) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-base font-semibold sm:text-lg">
            Unlock all {categoryName} videos
          </h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscribe to get unlimited access to every video in this category and
          its subcategories.
          {monthly?.unit_amount != null && (
            <>
              {" "}
              From{" "}
              <span className="font-semibold text-foreground">
                {fmt(monthly.unit_amount, monthly.currency)}/mo
              </span>
            </>
          )}
          {yearly?.unit_amount != null && (
            <>
              {" · "}
              <span className="font-semibold text-foreground">
                {fmt(yearly.unit_amount, yearly.currency)}/yr
              </span>
            </>
          )}
          .
        </p>
      </div>
      <div className="flex items-center gap-2">
        {monthly && (
          <Button
            variant="outline"
            onClick={() => onCheckout(monthly.stripe_price_id)}
            disabled={loadingPriceId === monthly.stripe_price_id}
          >
            {loadingPriceId === monthly.stripe_price_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Subscribe Monthly"
            )}
          </Button>
        )}
        {yearly && (
          <Button
            onClick={() => onCheckout(yearly.stripe_price_id)}
            disabled={loadingPriceId === yearly.stripe_price_id}
          >
            {loadingPriceId === yearly.stripe_price_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Subscribe Yearly"
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
