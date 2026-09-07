import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Agency Engine" },
      { name: "description", content: "Sign in or create your Agency Engine account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigate({ to: "/dashboard", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for the password reset link.");
        setMode("signin");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm before signing in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }


  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleApple() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Apple sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apple sign-in failed");
      setLoading(false);
    }
  }

  async function handleMicrosoft() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Microsoft sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Microsoft sign-in failed");
      setLoading(false);
    }
  }




  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <div className="hidden lg:flex flex-1 bg-sidebar border-r border-border p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-accent rounded flex items-center justify-center text-sm font-bold text-accent-foreground">
            A
          </div>
          <span className="font-bold tracking-tight">Agency Engine</span>
        </Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Operator OS
          </p>
          <h1 className="text-3xl font-bold leading-tight max-w-md">
            CRM, pipelines, conversations and calendar — one dense surface.
          </h1>
          <p className="text-sm text-muted-foreground mt-4 max-w-md">
            Run your agency on a single fast operator dashboard built for power users.
          </p>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          v1.0 · Live Sync
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Welcome back."
              : mode === "signup"
                ? "Get started in seconds."
                : "We'll email you a secure link to set a new password."}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full border border-border bg-card hover:bg-secondary rounded-md py-2 text-sm font-medium mb-2 disabled:opacity-50 transition-colors"
              >
                Continue with Google
              </button>

              <button
                onClick={handleApple}
                disabled={loading}
                className="w-full border border-border bg-card hover:bg-secondary rounded-md py-2 text-sm font-medium mb-2 disabled:opacity-50 transition-colors"
              >
                Continue with Apple
              </button>

              <button
                onClick={handleMicrosoft}
                disabled={loading}
                className="w-full border border-border bg-card hover:bg-secondary rounded-md py-2 text-sm font-medium mb-4 disabled:opacity-50 transition-colors"
              >
                Continue with Microsoft
              </button>



              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="font-mono text-[10px] uppercase text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>

          {mode === "signin" && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              <button onClick={() => setMode("forgot")} className="hover:underline">
                Forgot your password?
              </button>
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-4 text-center">
            {mode === "signin" ? "No account?" : "Already have one?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-accent font-medium hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}
