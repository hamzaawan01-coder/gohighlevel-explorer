import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMe,
  fetchGrantedPermissions,
  fetchUserPages,
  fetchUserAdAccounts,
  publicOrigin,
  metaScopes,
} from "@/lib/meta.server";

function redirectBack(status: "ok" | "error", message?: string) {
  const url = new URL(`${publicOrigin()}/settings/integrations`);
  url.searchParams.set("tab", "meta");
  url.searchParams.set("meta", status);
  if (message) url.searchParams.set("message", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/public/oauth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        if (err) {
          console.warn("Meta OAuth was not completed", {
            error: err,
            description: errorDescription,
            statePresent: Boolean(state),
          });
          return redirectBack("error", errorDescription || err);
        }
        if (!code || !state) {
          console.warn("Meta OAuth callback missing required values", {
            codePresent: Boolean(code),
            statePresent: Boolean(state),
          });
          return redirectBack("error", "Facebook did not return the required login details. Please try again.");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Consume the one-time state row.
        const { data: stateRows, error: stateErr } = await (supabaseAdmin as any)
          .from("meta_oauth_states")
          .select("*")
          .eq("state", state)
          .limit(1);
        if (stateErr) {
          console.error("Meta OAuth state lookup failed", { code: stateErr.code });
          return redirectBack("error", `state_${stateErr.code ?? "fail"}`);
        }
        const stateRow = (stateRows ?? [])[0];
        if (!stateRow) {
          console.warn("Meta OAuth state was not found");
          return redirectBack("error", "This Facebook login attempt is no longer valid. Please connect again.");
        }
        if (new Date(stateRow.expires_at).getTime() < Date.now()) {
          await (supabaseAdmin as any).from("meta_oauth_states").delete().eq("state", state);
          console.warn("Meta OAuth state expired", { subAccountId: stateRow.sub_account_id });
          return redirectBack("error", "Facebook login took too long. Please connect again.");
        }
        await (supabaseAdmin as any).from("meta_oauth_states").delete().eq("state", state);

        let shortTok: { access_token: string; expires_in?: number };
        try {
          shortTok = await exchangeCodeForToken(code);
        } catch (e) {
          console.error("Meta OAuth token exchange failed", e);
          return redirectBack("error", `token_exchange:${(e as Error).message.slice(0, 120)}`);
        }

        let longTok: { access_token: string; expires_in?: number };
        try {
          longTok = await exchangeForLongLivedToken(shortTok.access_token);
        } catch (e) {
          console.error("Meta OAuth long-lived token exchange failed", e);
          return redirectBack("error", `long_token:${(e as Error).message.slice(0, 120)}`);
        }

        let me: { id: string; name: string };
        try {
          me = await fetchMe(longTok.access_token);
        } catch (e) {
          console.error("Meta OAuth profile lookup failed", e);
          return redirectBack("error", `me:${(e as Error).message.slice(0, 120)}`);
        }

        let grantedScopes: string[] = [];
        try {
          grantedScopes = await fetchGrantedPermissions(longTok.access_token);
        } catch (e) {
          console.error("Meta OAuth permission lookup failed", e);
          return redirectBack("error", "Facebook connected, but its granted permissions could not be verified. Please try again.");
        }

        const expiresAt = longTok.expires_in
          ? new Date(Date.now() + longTok.expires_in * 1000).toISOString()
          : null;

        const { data: connUpsert, error: upErr } = await (supabaseAdmin as any)
          .from("meta_connections")
          .upsert(
            {
              sub_account_id: stateRow.sub_account_id,
              meta_user_id: me.id,
              meta_user_name: me.name,
              access_token: longTok.access_token,
              token_expires_at: expiresAt,
              granted_scopes: grantedScopes,
              created_by: stateRow.user_id,
            },
            { onConflict: "sub_account_id,meta_user_id" },
          )
          .select("id")
          .single();
        if (upErr) {
          console.error("Meta OAuth connection save failed", { code: upErr.code });
          return redirectBack("error", `save_${upErr.code ?? "fail"}`);
        }

        console.info("Meta OAuth connection completed", {
          subAccountId: stateRow.sub_account_id,
          metaUserId: me.id,
        });

        const connectionId = connUpsert.id as string;

        // Best-effort: pull pages + ad accounts right away.
        try {
          const pages = await fetchUserPages(longTok.access_token);
          for (const p of pages) {
            await (supabaseAdmin as any).from("meta_pages").upsert(
              {
                connection_id: connectionId,
                sub_account_id: stateRow.sub_account_id,
                page_id: p.id,
                page_name: p.name,
                page_access_token: p.access_token,
                category: p.category ?? null,
                instagram_business_account_id: p.instagram_business_account?.id ?? null,
              },
              { onConflict: "sub_account_id,page_id" },
            );
          }
        } catch { /* ignore; the settings page has a Refresh button */ }

        try {
          const accts = await fetchUserAdAccounts(longTok.access_token);
          for (const a of accts) {
            await (supabaseAdmin as any).from("meta_ad_accounts").upsert(
              {
                connection_id: connectionId,
                sub_account_id: stateRow.sub_account_id,
                ad_account_id: a.id,
                name: a.name ?? null,
                currency: a.currency ?? null,
                timezone_name: a.timezone_name ?? null,
              },
              { onConflict: "sub_account_id,ad_account_id" },
            );
          }
        } catch { /* ignore */ }

        const dest = new URL(stateRow.redirect_after || "/settings/integrations?tab=meta", publicOrigin());
        dest.searchParams.set("meta", "connected");
        const missingScopes = metaScopes().filter((scope) => !grantedScopes.includes(scope));
        if (missingScopes.length > 0) dest.searchParams.set("missing_scopes", missingScopes.join(","));
        return new Response(null, { status: 302, headers: { Location: dest.toString() } });
      },
    },
  },
});
