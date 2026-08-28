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
  metaRedirectUri,
  metaScopes,
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns, error } = await (supabaseAdmin as any)
      .from("meta_connections")
      .select("id, sub_account_id, meta_user_id, meta_user_name, token_expires_at, granted_scopes, created_at")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const conn = (conns ?? [])[0] ?? null;
    const setup = {
      appConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
      verifyTokenConfigured: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
      redirectUri: metaRedirectUri(),
      webhookBaseUrl: metaWebhookUrl("CONNECTION_ID"),
      scopes: metaScopes(),
    };
    if (!conn) return { connection: null, pages: [], adAccounts: [], setup };

    const [pagesRes, adAccountsRes] = await Promise.all([
      (supabaseAdmin as any).from("meta_pages")
        .select("id, sub_account_id, connection_id, page_id, page_name, category, instagram_business_account_id, route_messenger_to_inbox, route_instagram_to_inbox, sync_lead_ads, webhook_subscribed, created_at, updated_at")
        .eq("sub_account_id", data.subAccountId),
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pageRows } = await (supabaseAdmin as any)
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("meta_connections").delete().eq("sub_account_id", data.subAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Register the app-level webhook callback URL + fields with Meta automatically. */
export const configureMetaWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections").select("id").eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false }).limit(1);
    const conn = (conns ?? [])[0] as { id: string } | undefined;
    if (!conn) throw new Error("Connect Facebook first, then configure webhooks.");
    const callbackUrl = metaWebhookUrl(conn.id);
    const { configureAppWebhooks } = await import("./meta.server");
    const results = await configureAppWebhooks(callbackUrl);
    return { callbackUrl, results };
  });

/** List Lead Ad forms per page, plus current pipeline/stage mappings and options. */
export const listMetaLeadFormRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchPageLeadForms } = await import("./meta.server");

    const [pagesRes, routesRes, pipelinesRes, stagesRes] = await Promise.all([
      (supabaseAdmin as any).from("meta_pages")
        .select("id, page_id, page_name, page_access_token, sync_lead_ads")
        .eq("sub_account_id", data.subAccountId),
      (context.supabase as any).from("meta_lead_form_routes")
        .select("id, page_id, form_id, form_name, pipeline_id, stage_id")
        .eq("sub_account_id", data.subAccountId),
      (context.supabase as any).from("pipelines").select("id, name")
        .eq("sub_account_id", data.subAccountId).order("created_at", { ascending: true }),
      (context.supabase as any).from("pipeline_stages").select("id, pipeline_id, name, position")
        .eq("sub_account_id", data.subAccountId).order("position", { ascending: true }),
    ]);

    const pages = (pagesRes.data ?? []) as Array<{
      id: string; page_id: string; page_name: string; page_access_token: string; sync_lead_ads: boolean;
    }>;

    const forms: Array<{ pageId: string; pageName: string; formId: string; formName: string; status?: string }> = [];
    const errors: Array<{ pageName: string; error: string }> = [];
    for (const p of pages) {
      try {
        const list = await fetchPageLeadForms(p.page_id, p.page_access_token);
        for (const f of list) {
          forms.push({ pageId: p.page_id, pageName: p.page_name, formId: f.id, formName: f.name, status: f.status });
        }
      } catch (e) {
        errors.push({ pageName: p.page_name, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      forms,
      errors,
      routes: routesRes.data ?? [],
      pipelines: pipelinesRes.data ?? [],
      stages: stagesRes.data ?? [],
    };
  });

/** Map (or clear) the pipeline + stage used for opportunities from one Lead Ad form. */
export const setMetaLeadFormRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subAccountId: string;
    formId: string;
    formName?: string | null;
    pageId?: string | null;
    pipelineId?: string | null;
    stageId?: string | null;
  }) =>
    z.object({
      subAccountId: z.string().uuid(),
      formId: z.string().min(1),
      formName: z.string().nullish(),
      pageId: z.string().nullish(),
      pipelineId: z.string().uuid().nullish(),
      stageId: z.string().uuid().nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);

    if (!data.pipelineId || !data.stageId) {
      const { error } = await (context.supabase as any)
        .from("meta_lead_form_routes").delete()
        .eq("sub_account_id", data.subAccountId).eq("form_id", data.formId);
      if (error) throw new Error(error.message);
      return { ok: true, cleared: true };
    }

    const { data: stages, error: sErr } = await (context.supabase as any)
      .from("pipeline_stages").select("id")
      .eq("id", data.stageId).eq("pipeline_id", data.pipelineId)
      .eq("sub_account_id", data.subAccountId).limit(1);
    if (sErr) throw new Error(sErr.message);
    if (!(stages ?? [])[0]) throw new Error("That stage does not belong to the selected pipeline");

    const { error } = await (context.supabase as any)
      .from("meta_lead_form_routes")
      .upsert(
        {
          sub_account_id: data.subAccountId,
          page_id: data.pageId ?? null,
          form_id: data.formId,
          form_name: data.formName ?? null,
          pipeline_id: data.pipelineId,
          stage_id: data.stageId,
          created_by: context.userId,
        },
        { onConflict: "sub_account_id,form_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, cleared: false };
  });

/** Audit trail: recent Lead Ad ingestion events, newest first. */
export const listMetaLeadAdEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; formId?: string | null; limit?: number }) =>
    z.object({
      subAccountId: z.string().uuid(),
      formId: z.string().nullish(),
      limit: z.number().int().min(1).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    let q = (context.supabase as any)
      .from("meta_lead_ad_events")
      .select("id, page_id, form_id, form_name, leadgen_id, contact_id, deal_id, pipeline_id, stage_id, routing_source, status, error, is_test, lead_fields, payload, created_at")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (data.formId) q = q.eq("form_id", data.formId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const [pipesRes, stagesRes] = await Promise.all([
      (context.supabase as any).from("pipelines").select("id, name").eq("sub_account_id", data.subAccountId),
      (context.supabase as any).from("pipeline_stages").select("id, name").eq("sub_account_id", data.subAccountId),
    ]);
    return {
      events: rows ?? [],
      pipelineNames: Object.fromEntries(((pipesRes.data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name])),
      stageNames: Object.fromEntries(((stagesRes.data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name])),
    };
  });

const SAMPLE_LEAD_FIELDS: Record<string, string> = {
  full_name: "Test Lead",
  email: "test.lead@example.com",
  phone_number: "+10000000000",
};

/**
 * Replay the last received webhook payload for a Lead Ad form (or a sample lead
 * when none was received yet) so the mapped pipeline/stage can be verified
 * before going live. Writes an audit-trail row flagged as a test.
 */
export const replayMetaLeadAdTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; formId: string; formName?: string | null; pageId?: string | null }) =>
    z.object({
      subAccountId: z.string().uuid(),
      formId: z.string().min(1),
      formName: z.string().nullish(),
      pageId: z.string().nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ingestLeadAdLead } = await import("./meta.server");

    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections").select("id, created_by")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false }).limit(1);
    const conn = (conns ?? [])[0] as { id: string; created_by: string } | undefined;

    const { data: prev } = await (supabaseAdmin as any)
      .from("meta_lead_ad_events")
      .select("lead_fields, payload, page_id")
      .eq("sub_account_id", data.subAccountId)
      .eq("form_id", data.formId)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = (prev ?? [])[0] as { lead_fields: Record<string, string>; payload: unknown; page_id: string | null } | undefined;
    const fields = last && Object.keys(last.lead_fields ?? {}).length > 0 ? last.lead_fields : SAMPLE_LEAD_FIELDS;
    const usedSample = !(last && Object.keys(last.lead_fields ?? {}).length > 0);

    const result = await ingestLeadAdLead(supabaseAdmin as any, {
      subAccountId: data.subAccountId,
      ownerId: conn?.created_by ?? context.userId,
      pageId: data.pageId ?? last?.page_id ?? null,
      formId: data.formId,
      formName: data.formName ?? null,
      leadgenId: `test:${data.formId}`,
      fields,
      payload: last?.payload ?? { test: true, form_id: data.formId },
      isTest: true,
    });

    let pipelineName: string | null = null;
    let stageName: string | null = null;
    if (result.pipelineId) {
      const { data: p } = await (context.supabase as any).from("pipelines").select("name").eq("id", result.pipelineId).limit(1);
      pipelineName = (p ?? [])[0]?.name ?? null;
    }
    if (result.stageId) {
      const { data: s } = await (context.supabase as any).from("pipeline_stages").select("name").eq("id", result.stageId).limit(1);
      stageName = (s ?? [])[0]?.name ?? null;
    }

    return { ...result, pipelineName, stageName, usedSample };
  });

/**
 * Pull existing (historical) leads for one Lead Ad form from Meta and ingest
 * them. Deduplicates by Meta lead ID, so re-running is safe. Optional
 * since/until (ISO dates) restrict the import to a specific window.
 */
export const importPastMetaLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; formId: string; formName?: string | null; pageId?: string | null; maxLeads?: number; since?: string | null; until?: string | null }) =>
    z.object({
      subAccountId: z.string().uuid(),
      formId: z.string().min(1),
      formName: z.string().nullish(),
      pageId: z.string().nullish(),
      maxLeads: z.number().int().min(1).max(500).optional(),
      since: z.string().nullish(),
      until: z.string().nullish(),
    }).parse(d),
  )

  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchFormLeads, flattenLeadFields, ingestLeadAdLead } = await import("./meta.server");

    let pq = (supabaseAdmin as any)
      .from("meta_pages")
      .select("page_id, page_name, page_access_token, connection_id")
      .eq("sub_account_id", data.subAccountId)
      .order("sync_lead_ads", { ascending: false })
      .limit(1);
    if (data.pageId) pq = pq.eq("page_id", data.pageId);
    const { data: pageRows } = await pq;
    const page = (pageRows ?? [])[0] as { page_id: string; page_name: string; page_access_token: string } | undefined;
    if (!page) throw new Error("No connected Facebook Page found for this form. Connect Meta and refresh accounts first.");

    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections").select("created_by")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false }).limit(1);
    const ownerId = ((conns ?? [])[0]?.created_by as string | undefined) ?? context.userId;

    const sinceMs = data.since ? Date.parse(data.since) : null;
    const untilRaw = data.until ? Date.parse(data.until) : null;
    // Treat `until` as inclusive of the whole selected day.
    const untilMs = untilRaw !== null && !Number.isNaN(untilRaw) ? untilRaw + 24 * 60 * 60 * 1000 - 1 : null;

    let leads: Awaited<ReturnType<typeof fetchFormLeads>>;
    try {
      leads = await fetchFormLeads(data.formId, page.page_access_token, data.maxLeads ?? 200, {
        sinceMs: sinceMs !== null && !Number.isNaN(sinceMs) ? sinceMs : null,
        untilMs,
      });
    } catch (e) {
      throw new Error(`Meta rejected the lead history request: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Dedupe against leads already stored on contacts.
    const ids = leads.map((l) => l.id).filter(Boolean);
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows } = await (supabaseAdmin as any)
        .from("contacts").select("meta_lead_id")
        .eq("sub_account_id", data.subAccountId)
        .in("meta_lead_id", ids.slice(i, i + 200));
      for (const r of (rows ?? []) as Array<{ meta_lead_id: string | null }>) {
        if (r.meta_lead_id) existing.add(r.meta_lead_id);
      }
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const lead of leads) {
      if (!lead.id) continue;
      if (existing.has(lead.id)) { skipped++; continue; }
      const fields = flattenLeadFields(lead.field_data);
      try {
        const res = await ingestLeadAdLead(supabaseAdmin as any, {
          subAccountId: data.subAccountId,
          ownerId,
          pageId: page.page_id,
          formId: data.formId,
          formName: data.formName ?? null,
          leadgenId: lead.id,
          fields,
          payload: { source: "import", lead, window: { since: data.since ?? null, until: data.until ?? null } },
          isTest: false,
        });
        if (res.error) { failed++; if (errors.length < 5) errors.push(res.error); }
        else imported++;
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    return {
      total: leads.length,
      imported,
      skipped,
      failed,
      errors,
      pageName: page.page_name,
      pageId: page.page_id,
      formId: data.formId,
      formName: data.formName ?? null,
      since: data.since ?? null,
      until: data.until ?? null,
    };
  });

/**
 * Re-run ingestion for Lead Ads that previously failed. Reads the audit trail
 * for error rows, re-fetches each lead from Meta when possible (falling back to
 * the stored fields) and runs the same ingestion path — deduplication by Meta
 * lead ID keeps this safe to repeat.
 */
export const retryFailedMetaLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; formId?: string | null; limit?: number }) =>
    z.object({
      subAccountId: z.string().uuid(),
      formId: z.string().nullish(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchLeadById, flattenLeadFields, ingestLeadAdLead } = await import("./meta.server");

    let eq = (supabaseAdmin as any)
      .from("meta_lead_ad_events")
      .select("id, page_id, form_id, form_name, leadgen_id, lead_fields, payload, created_at")
      .eq("sub_account_id", data.subAccountId)
      .eq("status", "error")
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.formId) eq = eq.eq("form_id", data.formId);
    const { data: rows, error: evErr } = await eq;
    if (evErr) throw new Error(evErr.message);

    type Row = {
      id: string; page_id: string | null; form_id: string | null; form_name: string | null;
      leadgen_id: string | null; lead_fields: Record<string, string> | null; payload: unknown;
    };
    // One attempt per lead — newest failure wins.
    const byLead = new Map<string, Row>();
    for (const r of (rows ?? []) as Row[]) {
      if (!r.leadgen_id || r.leadgen_id.startsWith("test:")) continue;
      if (!byLead.has(r.leadgen_id)) byLead.set(r.leadgen_id, r);
    }
    const targets = [...byLead.values()];

    const { data: pageRows } = await (supabaseAdmin as any)
      .from("meta_pages")
      .select("page_id, page_name, page_access_token")
      .eq("sub_account_id", data.subAccountId)
      .order("sync_lead_ads", { ascending: false });
    const pages = (pageRows ?? []) as Array<{ page_id: string; page_name: string; page_access_token: string }>;
    const tokenFor = (pageId: string | null) =>
      (pageId ? pages.find((p) => p.page_id === pageId) : undefined) ?? pages[0];

    const { data: conns } = await (supabaseAdmin as any)
      .from("meta_connections").select("created_by")
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false }).limit(1);
    const ownerId = ((conns ?? [])[0]?.created_by as string | undefined) ?? context.userId;

    let recovered = 0;
    let stillFailing = 0;
    const errors: string[] = [];
    for (const row of targets) {
      const page = tokenFor(row.page_id);
      let fields: Record<string, string> = row.lead_fields ?? {};
      if (page) {
        try {
          const fresh = await fetchLeadById(row.leadgen_id!, page.page_access_token);
          const flat = flattenLeadFields(fresh.field_data);
          if (Object.keys(flat).length > 0) fields = flat;
        } catch {
          // Meta may no longer expose the lead — fall back to stored fields.
        }
      }
      if (Object.keys(fields).length === 0) {
        stillFailing++;
        if (errors.length < 5) errors.push(`Lead ${row.leadgen_id} has no recoverable fields`);
        continue;
      }
      try {
        const res = await ingestLeadAdLead(supabaseAdmin as any, {
          subAccountId: data.subAccountId,
          ownerId,
          pageId: row.page_id ?? page?.page_id ?? null,
          formId: row.form_id ?? null,
          formName: row.form_name ?? null,
          leadgenId: row.leadgen_id!,
          fields,
          payload: { source: "retry", original: row.payload ?? null },
          isTest: false,
        });
        if (res.error) {
          stillFailing++;
          if (errors.length < 5) errors.push(res.error);
        } else recovered++;
      } catch (e) {
        stillFailing++;
        if (errors.length < 5) errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    return { attempted: targets.length, recovered, stillFailing, errors };
  });


/**
 * Where did this contact / opportunity come from? Returns the Meta Page, Lead Ad
 * form and the webhook audit events that created the records.
 */
export const getMetaLeadSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; contactId?: string | null; dealId?: string | null }) =>
    z.object({
      subAccountId: z.string().uuid(),
      contactId: z.string().uuid().nullish(),
      dealId: z.string().uuid().nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);
    if (!data.contactId && !data.dealId) return { events: [], page: null, pipelineName: null, stageName: null };

    const sel =
      "id, page_id, form_id, form_name, leadgen_id, contact_id, deal_id, pipeline_id, stage_id, routing_source, status, error, is_test, lead_fields, payload, created_at";


    let q = (context.supabase as any)
      .from("meta_lead_ad_events")
      .select(sel)
      .eq("sub_account_id", data.subAccountId)
      .order("created_at", { ascending: false })
      .limit(10);
    q = data.contactId ? q.eq("contact_id", data.contactId) : q.eq("deal_id", data.dealId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as Array<{
      id: string; page_id: string | null; form_id: string | null; form_name: string | null;
      leadgen_id: string | null; contact_id: string | null; deal_id: string | null;
      pipeline_id: string | null; stage_id: string | null; routing_source: string;
      status: string; error: string | null; is_test: boolean; created_at: string;
      lead_fields: Record<string, string> | null;
      payload: unknown;
    }>;
    if (events.length === 0) return { events, page: null, pipelineName: null, stageName: null, leadFields: {} as Record<string, string>, contact: null };



    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pageId = events.find((e) => e.page_id)?.page_id ?? null;
    let page: { page_id: string; page_name: string } | null = null;
    if (pageId) {
      const { data: pRows } = await (supabaseAdmin as any)
        .from("meta_pages").select("page_id, page_name")
        .eq("sub_account_id", data.subAccountId).eq("page_id", pageId).limit(1);
      page = ((pRows ?? [])[0] as { page_id: string; page_name: string } | undefined) ?? null;
    }

    const latest = events[0];
    let pipelineName: string | null = null;
    let stageName: string | null = null;
    if (latest.pipeline_id) {
      const { data: p } = await (context.supabase as any).from("pipelines").select("name").eq("id", latest.pipeline_id).limit(1);
      pipelineName = (p ?? [])[0]?.name ?? null;
    }
    if (latest.stage_id) {
      const { data: s } = await (context.supabase as any).from("pipeline_stages").select("name").eq("id", latest.stage_id).limit(1);
      stageName = (s ?? [])[0]?.name ?? null;
    }

    const leadFields =
      (events.find((e) => e.lead_fields && Object.keys(e.lead_fields).length > 0)?.lead_fields ?? {}) as Record<string, string>;

    return { events, page, pipelineName, stageName, leadFields };
  });

