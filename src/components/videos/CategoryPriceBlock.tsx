import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PriceLike {
  stripe_price_id: string;
  unit_amount: number | null;
  currency: string | null;
}

interface Props {
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

export function CategoryPriceBlock({
  monthly,
  yearly,
  hasAccess,
  loadingPriceId,
  onCheckout,
}: Props) {
  if (hasAccess) {
    return (
      <div className="mt-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        You have access
      </div>
    );
  }
  if (!monthly && !yearly) return null;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div
      className="mt-4 space-y-2"
      onClick={stop}
      onMouseDown={stop}
    >
      <div className="text-xs text-muted-foreground">
        {monthly?.unit_amount != null && (
          <span>From {fmt(monthly.unit_amount, monthly.currency)}/mo</span>
        )}
        {monthly?.unit_amount != null && yearly?.unit_amount != null && (
          <span> · </span>
        )}
        {yearly?.unit_amount != null && (
          <span>{fmt(yearly.unit_amount, yearly.currency)}/yr</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {monthly && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              stop(e);
              onCheckout(monthly.stripe_price_id);
            }}
            disabled={loadingPriceId === monthly.stripe_price_id}
          >
            {loadingPriceId === monthly.stripe_price_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Monthly"
            )}
          </Button>
        )}
        {yearly && (
          <Button
            size="sm"
            className="flex-1"
            onClick={(e) => {
              stop(e);
              onCheckout(yearly.stripe_price_id);
            }}
            disabled={loadingPriceId === yearly.stripe_price_id}
          >
            {loadingPriceId === yearly.stripe_price_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Yearly"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
