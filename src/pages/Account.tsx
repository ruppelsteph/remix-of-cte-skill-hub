import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, CreditCard, CheckCircle, XCircle, ArrowRight, Settings, Loader2, RefreshCw, Copy, Link as LinkIcon, Users } from "lucide-react";
import { format } from "date-fns";

const Account = () => {
  const { user, isLoading, signOut, isSubscribed, isAdmin, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const hasHandledSuccess = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupSuccess, setGroupSuccess] = useState<{
    couponCode: string | null;
    seatCount: number | null;
  } | null>(null);

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

      // Group purchase success
      if (
        searchParams.get("group_purchase") === "success" &&
        !hasHandledSuccess.current
      ) {
        hasHandledSuccess.current = true;
        const sessionId = searchParams.get("session_id");
        try {
          let couponCode: string | null = null;
          let seatCount: number | null = null;
          if (sessionId) {
            const { data } = await supabase.functions.invoke("verify-group-purchase", {
              body: { sessionId },
            });
            couponCode = data?.couponCode ?? null;
            seatCount = data?.seatCount ?? null;
          }
          await supabase.functions.invoke("sync-subscription").catch(() => {});
          setGroupSuccess({ couponCode, seatCount });
          toast({
            title: "Group purchase successful!",
            description: couponCode
              ? `Your class code ${couponCode} is ready to share.`
              : "Your group is set up and ready to go.",
          });
          await refreshSubscription();
        } catch (err) {
          console.error("Error verifying group purchase:", err);
          toast({
            variant: "destructive",
            title: "Verification issue",
            description:
              "Payment succeeded but we couldn't record the group purchase. Please contact support.",
          });
        }
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

          {groupSuccess && (
            <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Your class is ready!</h3>
                    <p className="text-sm text-muted-foreground">
                      Share the class code or invite link below with your students. Each student creates an
                      account using the code and gets the same video access you purchased{groupSuccess.seatCount ? ` — up to ${groupSuccess.seatCount} students` : ""}.
                    </p>
                  </div>
                  {groupSuccess.couponCode && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background font-mono text-sm">
                        <span className="font-semibold text-primary">{groupSuccess.couponCode}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(groupSuccess.couponCode!);
                          toast({ title: "Code copied" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = `${window.location.origin}/join/${encodeURIComponent(groupSuccess.couponCode!)}`;
                          navigator.clipboard.writeText(link);
                          toast({ title: "Invite link copied", description: "Paste it in an email to your students." });
                        }}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" /> Copy invite link
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button asChild size="sm">
                      <Link to="/group-admin"><Users className="h-4 w-4 mr-2" /> Manage class</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setGroupSuccess(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        <p className="text-sm text-muted-foreground mb-1">Price</p>
                        <p className="text-sm text-foreground">
                          {user.priceAmount && user.priceCurrency
                            ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: user.priceCurrency }).format(user.priceAmount / 100)}/${user.priceInterval || 'month'}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Subscribed On</p>
                        <p className="text-sm text-foreground">
                          {user.subscriptionCreated ? format(new Date(user.subscriptionCreated), "MMMM d, yyyy") : "—"}
                        </p>
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
