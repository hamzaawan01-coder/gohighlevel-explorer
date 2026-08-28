import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Right after sign-in the session can still be settling in storage, and a
    // transient network blip on getUser() must not bounce a signed-in user.
    let session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      await new Promise((r) => setTimeout(r, 250));
      session = (await supabase.auth.getSession()).data.session;
    }
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase.auth.getUser();
    return { user: data.user ?? session.user };
  },
  component: () => <Outlet />,
});
