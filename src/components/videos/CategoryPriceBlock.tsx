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
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
    <div className="mt-4 border-t pt-4 text-center" onClick={stop} onMouseDown={stop}>
      <p className="mb-2 text-sm font-semibold text-foreground">Purchase Category</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {monthly && (
          <Button
            size="sm"
            className="flex-1 min-w-[140px] font-semibold"
            onClick={(e) => {
              stop(e);
              onCheckout(monthly.stripe_price_id);
            }}
            disabled={!!monthlyLoading}
          >
            {monthlyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>30 Day Access - {fmt(monthly.unit_amount, monthly.currency)}</>
            )}
          </Button>
        )}
        {yearly && (
          <Button
            size="sm"
            className="flex-1 min-w-[140px] font-semibold"
            onClick={(e) => {
              stop(e);
              onCheckout(yearly.stripe_price_id);
            }}
            disabled={!!yearlyLoading}
          >
            {yearlyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>365 Day Access - {fmt(yearly.unit_amount, yearly.currency)}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
