import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Users, Calendar, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface LookupResult {
  valid: boolean;
  reason?: string;
  groupName?: string;
  seatsLeft?: number;
  expiresAt?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: string | null;
}

const REASON_LABEL: Record<string, string> = {
  invalid_code: "We couldn't find that class code. Double-check the spelling.",
  inactive: "This class code has been deactivated by the teacher.",
  expired: "This class code has expired.",
  full: "This class is full — every seat has been claimed.",
  missing_code: "Enter your class code to continue.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  error: "Something went wrong validating that code.",
};

const Join = () => {
  const { code: codeFromPath } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(
    (codeFromPath || searchParams.get("code") || "").toUpperCase(),
  );
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Auto-lookup when a code arrives via URL
  useEffect(() => {
    if (code && !lookup) {
      void doLookup(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doLookup = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setLookup({ valid: false, reason: "missing_code" });
      return;
    }
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-coupon", {
        body: { code: trimmed },
      });
      if (error) {
        setLookup({ valid: false, reason: "error" });
      } else {
        setLookup(data as LookupResult);
      }
    } catch {
      setLookup({ valid: false, reason: "error" });
    } finally {
      setLookingUp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup?.valid) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-with-coupon", {
        body: { email, password, fullName, code },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Could not create account.";
        toast.error(msg);
        return;
      }
      setDone(true);
      toast.success("Account created. Check your email to verify it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <div className="container mx-auto max-w-lg py-16 px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Account created!</CardTitle>
              <CardDescription>
                We sent a verification email to <span className="font-medium">{email}</span>.
                Click the link inside, then sign in to start watching.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => navigate("/auth")}>Go to sign in</Button>
              <Button variant="outline" asChild>
                <Link to="/">Back to home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-lg py-12 px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" />
            Join your class
          </div>
          <h1 className="text-3xl font-bold">Redeem your class code</h1>
          <p className="text-muted-foreground mt-2">
            Your teacher gave you a code that starts with <span className="font-mono">CLASS-</span>. Enter it
            below and create your free student account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Class code</CardTitle>
            <CardDescription>
              Paste the code your teacher shared with you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setLookup(null);
                }}
                placeholder="CLASS-XXXXXX"
                className="font-mono uppercase"
                maxLength={64}
              />
              <Button
                type="button"
                onClick={() => doLookup(code)}
                disabled={lookingUp || !code.trim()}
              >
                {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
              </Button>
            </div>

            {lookup && !lookup.valid && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{REASON_LABEL[lookup.reason ?? ""] ?? "This code can't be used."}</span>
              </div>
            )}

            {lookup?.valid && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2 text-sm">
                <div className="font-semibold text-foreground">{lookup.groupName}</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {lookup.seatsLeft} seat{lookup.seatsLeft === 1 ? "" : "s"} left
                </div>
                {lookup.subscriptionEndsAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Access through {format(new Date(lookup.subscriptionEndsAt), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {lookup?.valid && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Create your student account</CardTitle>
              <CardDescription>
                You'll get the same video access your teacher purchased.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    At least 6 characters.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating account…
                    </>
                  ) : (
                    "Create account & join class"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </Layout>
  );
};

export default Join;
