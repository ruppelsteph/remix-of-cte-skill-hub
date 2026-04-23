import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event Supabase fires after parsing the
    // recovery token in the URL hash.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
        setLinkInvalid(false);
      }
    });

    // If the user lands here without a recovery hash and no existing session,
    // surface an "invalid/expired link" state after a short delay.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLinkInvalid(true);
      } else {
        setHasRecoverySession(true);
      }
    }, 800);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    if (password !== confirm) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      console.error("Error updating password:", err);
      toast({
        variant: "destructive",
        title: "Couldn't update password",
        description: err?.message || "Please try requesting a new reset link.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
            {linkInvalid && !hasRecoverySession ? (
              <div className="text-center py-4">
                <h1 className="text-2xl font-bold text-card-foreground mb-2">
                  Link expired or invalid
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  This password reset link is no longer valid. Please request a new one.
                </p>
                <Button asChild className="w-full">
                  <Link to="/auth/forgot">Request a new reset link</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-card-foreground mb-2">
                    Set a new password
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Enter and confirm your new password below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="mt-1"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update password
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
