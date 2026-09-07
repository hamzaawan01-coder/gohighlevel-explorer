import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readNextFromLocation } from "@/lib/safe-next";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Agency Engine" },
      { name: "description", content: "Completing your secure sign-in." },
      { property: "og:title", content: "Signing you in — Agency Engine" },
      { property: "og:description", content: "Completing your secure sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const next = readNextFromLocation(window.location.search);
    const go = (to: string) => {
      if (done) return;
      done = true;
      if (next && to === "/dashboard") {
        window.location.replace(next);
        return;
      }
      navigate({ to, replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go("/dashboard");
    });

    // Poll briefly: the OAuth helper sets the session shortly after redirect.
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        clearInterval(timer);
        go("/dashboard");
      } else if (tries > 20) {
        clearInterval(timer);
        go("/auth");
      }
    }, 250);

    return () => {
      clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground font-mono">Signing you in…</p>
    </div>
  );
}
