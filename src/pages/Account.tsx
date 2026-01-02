import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { User, CreditCard, CheckCircle, XCircle, ArrowRight } from "lucide-react";

const Account = () => {
  const { user, isLoading, signOut, isSubscribed } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
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
                    <h2 className="text-xl font-semibold text-card-foreground">{user.fullName}</h2>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Account ID</p>
                    <p className="text-sm font-mono text-foreground">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                    <p className="text-sm text-foreground">January 2024</p>
                  </div>
                </div>
              </div>

              {/* Subscription Status */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </h3>
                {isSubscribed ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Active Subscription</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Plan</p>
                        <p className="text-sm text-foreground capitalize">
                          {user.subscriptionPlan?.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Renews On</p>
                        <p className="text-sm text-foreground">{user.subscriptionEndDate}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4" disabled>
                      Manage Billing (Coming Soon)
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
