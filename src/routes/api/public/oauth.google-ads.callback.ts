import { createFileRoute } from "@tanstack/react-router";


const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API = "https://googleads.googleapis.com/v21";

function origin(): string {
  return process.env.PUBLIC_SITE_URL || "https://gohighlevel-explorer.lovable.app";
}

function redirectBack(status: "ok" | "error", message?: string) {
  const url = new URL(`${origin()}/marketing`);
  url.searchParams.set("google_ads", status);
  if (message) url.searchParams.set("message", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/public/oauth/google-ads/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return redirectBack("error", err);
        if (!code || !state) return redirectBack("error", "missing_code_or_state");

        const { verifyOauthState } = await import("@/lib/ads-oauth-state.server");
        const parsed = verifyOauthState(state);
        if (!parsed) return redirectBack("error", "invalid_state");
        const subId = parsed.sub;
        const uid = parsed.uid;

        const clientId = process.env.GOOGLE_ADS_CLIENT_ID!;
        const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
        const redirectUri = `${origin()}/api/public/oauth/google-ads/callback`;

        // Exchange code -> refresh token
        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) return redirectBack("error", `token_${tokenRes.status}`);
        const tok = await tokenRes.json() as { refresh_token?: string; access_token: string };
        if (!tok.refresh_token) return redirectBack("error", "no_refresh_token");

        // List accessible customers
        let accessible: { id: string; name?: string }[] = [];
        let listError: string | null = null;
        try {
          const listRes = await fetch(`${GOOGLE_ADS_API}/customers:listAccessibleCustomers`, {
            headers: { Authorization: `Bearer ${tok.access_token}`, "developer-token": devToken },
          });
          if (listRes.ok) {
            const j = await listRes.json() as { resourceNames?: string[] };
            accessible = (j.resourceNames ?? []).map((rn) => ({ id: rn.replace("customers/", "") }));
          } else {
            listError = `listAccessibleCustomers ${listRes.status}: ${(await listRes.text()).slice(0, 300)}`;
          }
        } catch (e) {
          listError = e instanceof Error ? e.message : String(e);
        }

        const first = accessible[0]?.id ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: upErr } = await supabaseAdmin
          .from("ad_platform_connections")
          .upsert({
            sub_account_id: subId,
            platform: "google",
            refresh_token: tok.refresh_token,
            accessible_customers: accessible,
            external_customer_id: first,
            connected_by: uid,
            last_sync_error: listError,
          }, { onConflict: "sub_account_id,platform" });
        if (upErr) return redirectBack("error", `save_${upErr.code ?? "fail"}`);

        if (listError) return redirectBack("ok", `list_customers_failed:${listError.slice(0, 200)}`);
        if (accessible.length === 0) return redirectBack("ok", "no_accessible_customers");
        return redirectBack("ok");
      },
    },
  },
});
