import { Loader2, ShoppingCart } from "lucide-react";
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

  const monthlyLoading = monthly && loadingPriceId === monthly.stripe_price_id;
  const yearlyLoading = yearly && loadingPriceId === yearly.stripe_price_id;

  return (
    <div
      className="mt-4 border-t pt-4"
      onClick={stop}
      onMouseDown={stop}
    >
      <div className="flex items-baseline gap-2">
        {monthly?.unit_amount != null ? (
          <>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {fmt(monthly.unit_amount, monthly.currency)}
            </span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </>
        ) : yearly?.unit_amount != null ? (
          <>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {fmt(yearly.unit_amount, yearly.currency)}
            </span>
            <span className="text-sm text-muted-foreground">/ year</span>
          </>
        ) : null}
      </div>
      {monthly?.unit_amount != null && yearly?.unit_amount != null && (
        <p className="mt-1 text-xs text-muted-foreground">
          or {fmt(yearly.unit_amount, yearly.currency)} billed yearly
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {monthly && (
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              stop(e);
              onCheckout(monthly.stripe_price_id);
            }}
            disabled={!!monthlyLoading}
          >
            {monthlyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Subscribe Monthly
              </>
            )}
          </Button>
        )}
        {yearly && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={(e) => {
              stop(e);
              onCheckout(yearly.stripe_price_id);
            }}
            disabled={!!yearlyLoading}
          >
            {yearlyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Purchase Yearly
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
