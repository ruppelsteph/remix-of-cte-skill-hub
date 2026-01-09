import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, CreditCard, CheckCircle, XCircle, ArrowRight, Settings, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const Account = () => {
  const { user, isLoading, signOut, isSubscribed, isAdmin, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const hasHandledSuccess = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  // Check for success parameter, sync subscription data, and refresh (only once)
  useEffect(() => {
    const syncAndRefresh = async () => {
      if (searchParams.get("success") === "true" && !hasHandledSuccess.current) {
        hasHandledSuccess.current = true;

        // Sync subscription data from Stripe to database
        try {
          await supabase.functions.invoke("sync-subscription");
        } catch (err) {
          console.error("Error syncing subscription:", err);
        }

        toast({
          title: "Payment successful!",
          description: "Your subscription is now active.",
        });
        await refreshSubscription();
        // Clear the success param from URL to prevent re-triggering
        setSearchParams({}, { replace: true });
      }
    };
    syncAndRefresh();
  }, [searchParams, setSearchParams, refreshSubscription, toast]);

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open subscription management.",
      });
    }
  };

  const handleRefreshSubscription = async () => {
    try {
      setIsRefreshing(true);
      await refreshSubscription();
      toast({
        title: "Subscription refreshed",
        description: "Your account status has been updated.",
      });
    } catch (err) {
      console.error("Error refreshing subscription:", err);
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: "Couldn't refresh subscription status. Please try again.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="py-12 lg:py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-foreground mb-8">My Account</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-card-foreground">{user.fullName || "User"}</h2>
                    <p className="text-muted-foreground">{user.email}</p>
                    {isAdmin && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Account ID</p>
                    <p className="text-sm font-mono text-foreground">{user.id.slice(0, 8)}...</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <p className="text-sm text-foreground">{isSubscribed ? "Subscribed" : "Free"}</p>
                  </div>
                </div>
              </div>

              {/* Subscription Status */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription
                  </h3>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshSubscription}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>

                {isSubscribed ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">
                        {user.subscriptionStatus === "trialing" ? "Trial" : "Active"} Subscription
                      </span>
                      {user.subscriptionStatus && (
                        <span className="ml-2 px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded capitalize">
                          {user.subscriptionStatus}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Plan</p>
                        <p className="text-sm text-foreground">{user.productName || "Subscription"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {user.subscriptionStatus === "trialing" ? "Trial Ends On" : "Auto-Renews On"}
                        </p>
                        <p className="text-sm text-foreground">
                          {user.subscriptionEnd ? format(new Date(user.subscriptionEnd), "MMMM d, yyyy") : "—"}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4" onClick={handleManageSubscription}>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <XCircle className="h-5 w-5" />
                      <span>No Active Subscription</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Subscribe to get full access to all CTE Skills videos and learning resources.
                    </p>
                    <Button asChild>
                      <Link to="/pricing">
                        View Plans
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {isAdmin && (
                    <Button asChild variant="default" className="w-full justify-start">
                      <Link to="/admin">Admin Portal</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link to="/videos">Browse Videos</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link to="/pathways">Explore Pathways</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => {
                      signOut();
                      navigate("/");
                    }}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>

              {!isSubscribed && (
                <div className="bg-primary/5 rounded-xl border border-primary/20 p-6">
                  <h3 className="font-semibold text-foreground mb-2">Upgrade to Pro</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get unlimited access to all videos starting at $9.99/month.
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link to="/pricing">Upgrade Now</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Account;
