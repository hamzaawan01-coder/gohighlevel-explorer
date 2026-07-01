import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes } from "crypto";
import {
  buildAuthorizeUrl,
  fetchUserPages,
  fetchUserAdAccounts,
  fetchAdAccountInsights,
  subscribePageToApp,
  sendPageMessage,
  metaWebhookUrl,
} from "./meta.server";

type MetaConnectionRow = {
  id: string;
  sub_account_id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  access_token: string;
  token_expires_at: string | null;
  granted_scopes: string[];
};

type MetaPageRow = {
  id: string;
  connection_id: string;
  sub_account_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  category: string | null;
  instagram_business_account_id: string | null;
  webhook_subscribed: boolean;
  route_messenger_to_inbox: boolean;
  route_instagram_to_inbox: boolean;
  sync_lead_ads: boolean;
};

async function ensureSubAccess(supabase: any, userId: string, subId: string) {
  const { data, error } = await supabase.rpc("has_subaccount_access", { _user: userId, _sub: subId });
  if (error || !data) throw new Error("Forbidden: no access to this workspace");
}

/** Start OAuth: create signed state, return Facebook authorize URL. */
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; redirectAfter?: string }) =>
    z.object({ subAccountId: z.string().uuid(), redirectAfter: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    if (!process.env.META_APP_ID) throw new Error("META_APP_ID is not configured yet. Ask an admin to add it.");

    const state = randomBytes(24).toString("base64url");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("meta_oauth_states")
      .insert({
        state,
        sub_account_id: data.subAccountId,
        user_id: context.userId,
        redirect_after: data.redirectAfter ?? "/settings/integrations?tab=meta",
      });
    if (error) throw new Error(`Could not persist OAuth state: ${error.message}`);
    return { url: buildAuthorizeUrl(state) };
  });

/** Fetch the currently-linked Meta connection for a sub-account. */
export const getMetaConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { data: conns, error } = await (context.supabase as any)
      .from("meta_connections")
      .select("id, sub_account_id, meta_user_id, meta_user_name, token_expires_at, granted_scopes, created_at")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const conn = (conns ?? [])[0] ?? null;
    if (!conn) return { connection: null, pages: [], adAccounts: [] };

    const [pagesRes, adAccountsRes] = await Promise.all([
      (context.supabase as any).from("meta_pages").select("*").eq("sub_account_id", data.subAccountId),
      (context.supabase as any).from("meta_ad_accounts").select("*").eq("sub_account_id", data.subAccountId),
    ]);
    return {
      connection: conn,
      pages: pagesRes.data ?? [],
      adAccounts: adAccountsRes.data ?? [],
      webhookUrl: metaWebhookUrl(conn.id),
      webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
    };
  });

/** Refresh pages / ad accounts from Meta and upsert into our tables. */
export const refreshMetaAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections")
      .select("*")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false })
      .limit(1);
    const conn = (conns ?? [])[0] as MetaConnectionRow | undefined;
    if (!conn) throw new Error("No Meta connection linked to this workspace.");

    const [pages, adAccounts] = await Promise.all([
      fetchUserPages(conn.access_token),
      fetchUserAdAccounts(conn.access_token),
    ]);

    for (const p of pages) {
      await (supabaseAdmin as any).from("meta_pages").upsert(
        {
          connection_id: conn.id,
          sub_account_id: data.subAccountId,
          page_id: p.id,
          page_name: p.name,
          page_access_token: p.access_token,
          category: p.category ?? null,
          instagram_business_account_id: p.instagram_business_account?.id ?? null,
        },
        { onConflict: "sub_account_id,page_id" },
      );
    }

    for (const a of adAccounts) {
      await (supabaseAdmin as any).from("meta_ad_accounts").upsert(
        {
          connection_id: conn.id,
          sub_account_id: data.subAccountId,
          ad_account_id: a.id,
          name: a.name ?? null,
          currency: a.currency ?? null,
          timezone_name: a.timezone_name ?? null,
        },
        { onConflict: "sub_account_id,ad_account_id" },
      );
    }

    return { pages: pages.length, adAccounts: adAccounts.length };
  });

/** Subscribe a page to webhooks + toggle inbox routing flags. */
export const updateMetaPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    pageRowId: string;
    subAccountId: string;
    route_messenger_to_inbox?: boolean;
    route_instagram_to_inbox?: boolean;
    sync_lead_ads?: boolean;
    subscribe?: boolean;
  }) =>
    z.object({
      pageRowId: z.string().uuid(),
      subAccountId: z.string().uuid(),
      route_messenger_to_inbox: z.boolean().optional(),
      route_instagram_to_inbox: z.boolean().optional(),
      sync_lead_ads: z.boolean().optional(),
      subscribe: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pageRows } = await (supabaseAdmin as any)
      .from("meta_pages")
      .select("*")
      .eq("id", data.pageRowId)
      .eq("sub_account_id", data.subAccountId)
      .limit(1);
    const page = (pageRows ?? [])[0] as MetaPageRow | undefined;
    if (!page) throw new Error("Page not found in this workspace");

    const patch: Record<string, unknown> = {};
    if (typeof data.route_messenger_to_inbox === "boolean") patch.route_messenger_to_inbox = data.route_messenger_to_inbox;
    if (typeof data.route_instagram_to_inbox === "boolean") patch.route_instagram_to_inbox = data.route_instagram_to_inbox;
    if (typeof data.sync_lead_ads === "boolean") patch.sync_lead_ads = data.sync_lead_ads;

    if (data.subscribe) {
      try {
        await subscribePageToApp(page.page_id, page.page_access_token);
        patch.webhook_subscribed = true;
      } catch (e) {
        throw new Error(`Could not subscribe page to webhooks: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await (supabaseAdmin as any).from("meta_pages").update(patch).eq("id", page.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Toggle an ad account's "use for reports" flag. */
export const updateMetaAdAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rowId: string; subAccountId: string; use_for_reports: boolean }) =>
    z.object({ rowId: z.string().uuid(), subAccountId: z.string().uuid(), use_for_reports: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { error } = await (context.supabase as any)
      .from("meta_ad_accounts")
      .update({ use_for_reports: data.use_for_reports })
      .eq("id", data.rowId)
      .eq("sub_account_id", data.subAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Read cached ad-account insights (last 30d) live from Graph API. */
export const getMetaAdInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections").select("*").eq("sub_account_id", data.subAccountId).limit(1);
    const conn = (conns ?? [])[0] as MetaConnectionRow | undefined;
    if (!conn) return { rows: [] };
    const { data: accts } = await (supabaseAdmin as any)
      .from("meta_ad_accounts").select("*").eq("sub_account_id", data.subAccountId).eq("use_for_reports", true);
    const rows: Array<{ ad_account_id: string; name: string | null; currency: string | null; spend: number; impressions: number; clicks: number }> = [];
    for (const a of (accts ?? []) as Array<{ ad_account_id: string; name: string | null; currency: string | null }>) {
      try {
        const insights = await fetchAdAccountInsights(a.ad_account_id, conn.access_token, "last_30d");
        const row = insights[0];
        rows.push({
          ad_account_id: a.ad_account_id,
          name: a.name,
          currency: a.currency,
          spend: Number(row?.spend ?? 0),
          impressions: Number(row?.impressions ?? 0),
          clicks: Number(row?.clicks ?? 0),
        });
      } catch {
        // skip failing accounts silently in the aggregate view
      }
    }
    return { rows };
  });

/** Send a Messenger or Instagram DM reply from an inbox conversation. */
export const sendMetaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; pageRowId: string; recipientId: string; text: string }) =>
    z.object({
      subAccountId: z.string().uuid(),
      pageRowId: z.string().uuid(),
      recipientId: z.string().min(1),
      text: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { data: pageRows } = await (context.supabase as any)
      .from("meta_pages").select("*")
      .eq("id", data.pageRowId).eq("sub_account_id", data.subAccountId).limit(1);
    const page = (pageRows ?? [])[0] as MetaPageRow | undefined;
    if (!page) throw new Error("Page not found in this workspace");
    return sendPageMessage(page.page_id, page.page_access_token, data.recipientId, data.text);
  });

/** Fully disconnect Meta from a sub-account. */
export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { error } = await (context.supabase as any)
      .from("meta_connections").delete().eq("sub_account_id", data.subAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
