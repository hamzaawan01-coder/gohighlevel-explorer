/**
 * Server-only helpers for Meta Graph API (Facebook / Instagram / Ads).
 * Never import from route/component code — call via createServerFn wrappers.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { getRequest } from "@tanstack/react-start/server";

export const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Lead-only base scopes: the minimum needed to read Lead Ads forms and
 * receive new leads via the Page `leadgen` webhook.
 * Everything else (messaging, ads insights, ads management, business
 * management, Instagram, email) is opt-in via META_EXTRA_SCOPES so that one
 * unapproved permission cannot block the whole connection.
 */
export const META_BASE_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  // Required by Meta to read /{page}/leadgen_forms — without it the forms
  // list comes back with error #200 "Requires pages_manage_ads permission".
  "pages_manage_ads",
  "leads_retrieval",
] as const;

/**
 * Messaging scopes, requested only when the user explicitly connects
 * Messenger/Instagram replies. Kept out of the lead-only flow so an
 * unapproved messaging permission cannot block lead capture.
 * (WhatsApp replies run through Twilio, not Meta OAuth.)
 */
export const META_MESSAGING_SCOPES = [
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
] as const;

/**
 * Ads scopes, requested only when the user explicitly wants ad accounts and
 * campaign spend pulled in. `ads_read` is what makes /me/adaccounts return
 * anything at all, so a lead-only connection never sees ad accounts.
 */
export const META_ADS_SCOPES = ["ads_read"] as const;

/**
 * Business portfolio scopes. `business_management` is what lets us walk
 * /me/businesses and pull the Pages / ad accounts a portfolio owns or has
 * partner access to — including Pages the signed-in user holds only through
 * the portfolio, which /me/accounts never returns.
 */
export const META_BUSINESS_SCOPES = ["business_management"] as const;

export type MetaOAuthMode = "leads" | "messaging" | "ads" | "business";

export function metaScopes(mode: MetaOAuthMode = "leads"): string[] {
  const extra = (process.env.META_EXTRA_SCOPES || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const messaging = mode === "messaging" ? [...META_MESSAGING_SCOPES] : [];
  const ads = mode === "ads" ? [...META_ADS_SCOPES] : [];
  const business = mode === "business" ? [...META_BUSINESS_SCOPES, ...META_ADS_SCOPES] : [];
  return [...new Set([...META_BASE_SCOPES, ...messaging, ...ads, ...business, ...extra])];
}


/** Backwards-compatible export used by UI/setup panels. */
export const META_SCOPES = META_BASE_SCOPES;



const FALLBACK_ORIGIN = "https://gohighlevel-explorer.lovable.app";

/**
 * Origin used for OAuth redirect URIs and webhook URLs.
 * Prefers the domain of the incoming request so custom domains
 * (e.g. leadsconvert.co.uk) work without redirect_uri mismatches.
 */
export function publicOrigin(): string {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  try {
    const req = getRequest() as Request | undefined;
    if (req) {
      const headers = req.headers;
      const forwardedHost = headers.get("x-forwarded-host");
      const proto = headers.get("x-forwarded-proto") || "https";
      const host = forwardedHost || headers.get("host") || new URL(req.url).host;
      if (host && !/^localhost|^127\.0\.0\.1/.test(host)) {
        return `${proto}://${host.split(",")[0]!.trim()}`;
      }
    }
  } catch {
    // no request scope — fall through
  }
  return FALLBACK_ORIGIN;
}


export function metaRedirectUri(): string {
  return `${publicOrigin()}/api/public/oauth/meta/callback`;
}

export function metaWebhookUrl(token: string): string {
  return `${publicOrigin()}/api/public/hooks/meta/${encodeURIComponent(token)}`;
}

export function buildAuthorizeUrl(state: string, mode: MetaOAuthMode = "leads"): string {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID is not configured");
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", metaRedirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", metaScopes(mode).join(","));
  return u.toString();
}

async function graph<T>(path: string, params: Record<string, string> = {}, token?: string): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & Record<string, unknown>;
  if (!res.ok || body.error) {
    throw new Error(`Meta Graph ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return body as T;
}

/** Exchange short-lived code for short-lived user access token. */
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  if (!appId || !appSecret) throw new Error("META_APP_ID/META_APP_SECRET not configured");
  return graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: metaRedirectUri(),
    code,
  });
}

/** Upgrade short-lived to long-lived (~60 day) user token. */
export async function exchangeForLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  return graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
}

export async function fetchMe(token: string): Promise<{ id: string; name: string; email?: string }> {
  return graph("/me", { fields: "id,name,email" }, token);
}

/** Read the permissions Meta actually granted; users may decline individual scopes. */
export async function fetchGrantedPermissions(token: string): Promise<string[]> {
  const result = await graph<{
    data?: Array<{ permission?: string; status?: string }>;
  }>("/me/permissions", {}, token);
  return (result.data ?? [])
    .filter((entry) => entry.status === "granted" && entry.permission)
    .map((entry) => entry.permission as string);
}

export type MetaPageDTO = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  instagram_business_account?: { id: string };
};

/** Walk every page of /me/accounts so large portfolios import fully. */
export async function fetchUserPages(token: string): Promise<MetaPageDTO[]> {
  const out: MetaPageDTO[] = [];
  let after: string | undefined;
  for (let i = 0; i < 40; i++) {
    const r = await graph<{ data?: MetaPageDTO[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      "/me/accounts",
      {
        fields: "id,name,access_token,category,instagram_business_account",
        limit: "100",
        ...(after ? { after } : {}),
      },
      token,
    );
    out.push(...(r.data ?? []));
    if (!r.paging?.next || !r.paging?.cursors?.after) break;
    after = r.paging.cursors.after;
  }
  return out;
}


export type MetaAdAccountDTO = {
  id: string; // act_...
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

/**
 * Ad accounts need `ads_read`, which lead-only connections do not grant — Meta
 * then answers with "(#100) Unsupported get request". Treat that as "no ad
 * accounts" instead of failing the whole refresh.
 */
export async function fetchUserAdAccounts(token: string): Promise<MetaAdAccountDTO[]> {
  try {
    const r = await graph<{ data: MetaAdAccountDTO[] }>(
      "/me/adaccounts",
      { fields: "id,name,currency,timezone_name,account_status", limit: "200" },
      token,
    );
    return r.data ?? [];
  } catch (e) {
    console.warn("[meta] ad accounts unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

export type MetaBusinessDTO = { id: string; name?: string };

/** Business portfolios (Business Manager) the signed-in user can see. Needs `business_management`. */
export async function fetchUserBusinesses(token: string): Promise<MetaBusinessDTO[]> {
  try {
    const out: MetaBusinessDTO[] = [];
    let after: string | undefined;
    for (let i = 0; i < 20; i++) {
      const r = await graph<{ data?: MetaBusinessDTO[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        "/me/businesses",
        { fields: "id,name", limit: "100", ...(after ? { after } : {}) },
        token,
      );
      out.push(...(r.data ?? []));
      if (!r.paging?.next || !r.paging?.cursors?.after) break;
      after = r.paging.cursors.after;
    }
    return out;
  } catch (e) {
    console.warn("[meta] businesses unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function graphEdgeAll<T>(path: string, fields: string, token: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await graph<{ data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        path,
        { fields, limit: "100", ...(after ? { after } : {}) },
        token,
      );
      out.push(...(r.data ?? []));
      if (!r.paging?.next || !r.paging?.cursors?.after) break;
      after = r.paging.cursors.after;
    } catch (e) {
      console.warn(`[meta] ${path} unavailable:`, e instanceof Error ? e.message : e);
      break;
    }
  }
  return out;
}

/**
 * Pages owned by, or shared with, every visible business portfolio.
 * Complements /me/accounts, which omits Pages the user holds only via a portfolio.
 */
export async function fetchBusinessPages(
  token: string,
): Promise<{ pages: MetaPageDTO[]; businesses: MetaBusinessDTO[] }> {
  const businesses = await fetchUserBusinesses(token);
  const byId = new Map<string, MetaPageDTO>();
  const fields = "id,name,access_token,category,instagram_business_account";
  for (const b of businesses) {
    for (const edge of ["owned_pages", "client_pages"]) {
      const rows = await graphEdgeAll<MetaPageDTO>(`/${b.id}/${edge}`, fields, token);
      for (const p of rows) {
        if (!p?.id) continue;
        // A Page without a token cannot be subscribed to webhooks; keep the
        // richest record we have for it.
        const prev = byId.get(p.id);
        if (!prev || (!prev.access_token && p.access_token)) byId.set(p.id, p);
      }
    }
  }
  return { pages: [...byId.values()], businesses };
}

/** Ad accounts owned by / shared with the visible business portfolios. */
export async function fetchBusinessAdAccounts(token: string): Promise<MetaAdAccountDTO[]> {
  const businesses = await fetchUserBusinesses(token);
  const byId = new Map<string, MetaAdAccountDTO>();
  const fields = "id,name,currency,timezone_name,account_status";
  for (const b of businesses) {
    for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
      const rows = await graphEdgeAll<MetaAdAccountDTO>(`/${b.id}/${edge}`, fields, token);
      for (const a of rows) if (a?.id) byId.set(a.id, a);
    }
  }
  return [...byId.values()];
}




export type MetaInsightsRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  date_start?: string;
  date_stop?: string;
};

export async function fetchAdAccountInsights(
  adAccountId: string,
  token: string,
  datePreset: "last_7d" | "last_30d" | "last_90d" = "last_30d",
): Promise<MetaInsightsRow[]> {
  const r = await graph<{ data: MetaInsightsRow[] }>(
    `/${adAccountId}/insights`,
    { fields: "spend,impressions,clicks,ctr,cpc,reach", date_preset: datePreset },
    token,
  );
  return r.data ?? [];
}

export type MetaCampaignDailyRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start?: string;
  date_stop?: string;
  actions?: { action_type: string; value: string }[];
};

/**
 * Daily, campaign-level insights for one ad account (Marketing API).
 * Used by the scheduled ads sync so ad spend / ROI reporting stays current.
 */
export async function fetchCampaignDailyInsights(
  adAccountId: string,
  token: string,
  datePreset: "last_7d" | "last_14d" | "last_30d" = "last_7d",
): Promise<MetaCampaignDailyRow[]> {
  const r = await graph<{ data: MetaCampaignDailyRow[] }>(
    `/${adAccountId}/insights`,
    {
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
      level: "campaign",
      time_increment: "1",
      date_preset: datePreset,
      limit: "500",
    },
    token,
  );
  return r.data ?? [];
}

/**
 * Subscribe a page to the app. Messaging fields need `pages_messaging`, which
 * lead-only connections do not grant, so we fall back to `leadgen` alone.
 * Meta also returns transient "unexpected error" responses here, so each field
 * set is retried with a short backoff before giving up.
 */
export async function subscribePageToApp(pageId: string, pageAccessToken: string): Promise<void> {
  const call = async (fields: string) => {
    const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("subscribed_fields", fields);
    const res = await fetch(url.toString(), { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string; code?: number };
    };
    return {
      ok: res.ok && !body.error,
      message: body.error?.message ?? String(res.status),
      code: body.error?.code,
    };
  };

  const attempt = async (fields: string) => {
    let last = await call(fields);
    for (let i = 0; i < 2 && !last.ok; i++) {
      // Codes 1/2 and 5xx are Meta-side transient failures — worth a retry.
      const transient = last.code === 1 || last.code === 2 || /unexpected error/i.test(last.message);
      if (!transient) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      last = await call(fields);
    }
    return last;
  };

  const full = await attempt("leadgen,messages,messaging_postbacks,message_reads");
  if (full.ok) return;

  // Fall back to lead-only fields regardless of why the full set failed.
  const leadOnly = await attempt("leadgen");
  if (leadOnly.ok) return;
  throw new Error(`Subscribe page failed: ${leadOnly.message}`);
}



/**
 * Register the app-level webhook callback URL + fields with Meta.
 * Uses the app access token (app_id|app_secret) so no user token is needed.
 */
export async function configureAppWebhooks(callbackUrl: string): Promise<{ object: string; ok: boolean; error?: string }[]> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET are not configured");
  if (!verifyToken) throw new Error("META_WEBHOOK_VERIFY_TOKEN is not configured");

  const targets: Array<{ object: string; fields: string }> = [
    { object: "page", fields: "messages,messaging_postbacks,message_reads,leadgen" },
    { object: "instagram", fields: "messages" },
  ];

  const results: { object: string; ok: boolean; error?: string }[] = [];
  for (const t of targets) {
    const url = new URL(`${GRAPH_BASE}/${appId}/subscriptions`);
    const params = new URLSearchParams({
      object: t.object,
      callback_url: callbackUrl,
      fields: t.fields,
      verify_token: verifyToken,
      include_values: "true",
      access_token: `${appId}|${appSecret}`,
    });
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || body.error) results.push({ object: t.object, ok: false, error: body.error?.message ?? `HTTP ${res.status}` });
    else results.push({ object: t.object, ok: true });
  }
  return results;
}

export async function sendPageMessage(
  pageId: string,
  pageAccessToken: string,
  recipientId: string,
  text: string,
): Promise<{ message_id?: string }> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/messages`);
  url.searchParams.set("access_token", pageAccessToken);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(`Meta send message failed: ${body.error?.message ?? res.status}`);
  return body;
}

/** Fetch a Lead Ads lead by its ID (requires page or ad account token with leads_retrieval). */
export async function fetchLeadById(
  leadId: string,
  pageAccessToken: string,
): Promise<{ id: string; created_time: string; field_data: Array<{ name: string; values: string[] }>; form_id?: string }> {
  return graph(`/${leadId}`, { fields: "id,created_time,field_data,form_id" }, pageAccessToken);
}

/** List the Lead Ad forms configured on a Facebook Page. */
export async function fetchPageLeadForms(
  pageId: string,
  pageAccessToken: string,
): Promise<Array<{ id: string; name: string; status?: string }>> {
  const res = await graph<{ data?: Array<{ id: string; name: string; status?: string }> }>(
    `/${pageId}/leadgen_forms`,
    { fields: "id,name,status", limit: "100" },
    pageAccessToken,
  );
  return res.data ?? [];
}

export type MetaFormLead = {
  id: string;
  created_time?: string;
  field_data?: Array<{ name: string; values: string[] }>;
};

/**
 * List existing (historical) leads for a Lead Ad form, following Graph paging.
 * Used by the "Import past leads" action — the webhook only catches new leads.
 * Optional window filters on Meta's created_time (leads come back newest-first,
 * so paging stops once we walk past the start of the window).
 */
export async function fetchFormLeads(
  formId: string,
  pageAccessToken: string,
  maxLeads = 500,
  window?: { sinceMs?: number | null; untilMs?: number | null },
): Promise<MetaFormLead[]> {
  const out: MetaFormLead[] = [];
  let after: string | undefined;
  const sinceMs = window?.sinceMs ?? null;
  const untilMs = window?.untilMs ?? null;
  for (let page = 0; page < 20 && out.length < maxLeads; page++) {
    const params: Record<string, string> = { fields: "id,created_time,field_data", limit: "100" };
    if (after) params.after = after;
    const res = await graph<{ data?: MetaFormLead[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/${formId}/leads`,
      params,
      pageAccessToken,
    );
    const batch = res.data ?? [];
    let walkedPastWindow = false;
    for (const lead of batch) {
      const t = lead.created_time ? Date.parse(lead.created_time) : NaN;
      if (!Number.isNaN(t)) {
        if (sinceMs !== null && t < sinceMs) { walkedPastWindow = true; continue; }
        if (untilMs !== null && t > untilMs) continue;
      }
      out.push(lead);
    }
    after = res.paging?.next ? res.paging?.cursors?.after : undefined;
    if (!after || batch.length === 0 || walkedPastWindow) break;
  }
  return out.slice(0, maxLeads);
}


/** Flatten Meta field_data into a simple { field: value } map (multi-values joined). */
export function flattenLeadFields(fieldData: Array<{ name: string; values: string[] }> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fieldData ?? []) {
    if (f?.name && Array.isArray(f.values) && f.values.length > 0) {
      out[f.name] = f.values.map((v) => String(v)).join(", ");
    }
  }
  return out;
}


/** Verify Meta X-Hub-Signature-256 header against the raw request body. */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Creates an opportunity (deal) for a freshly captured lead so it shows up on
 * the Opportunities board, not just in Contacts. Uses the pipeline/stage mapped
 * to the Lead Ad form when configured, otherwise the sub-account's first
 * pipeline and its first stage. Safe no-op when no pipeline exists.
 */
export type LeadRoutingResult = {
  dealId: string | null;
  pipelineId: string | null;
  stageId: string | null;
  routingSource: "mapped" | "default" | "none";
  duplicate: boolean;
  error?: string;
};

export async function createOpportunityForLead(
  admin: { from: (t: string) => any },
  args: { subAccountId: string; contactId: string | null; title: string; source: string; formId?: string | null },
): Promise<LeadRoutingResult> {
  let pipeline: { id: string; owner_id: string } | undefined;
  let stage: { id: string } | undefined;
  let routingSource: LeadRoutingResult["routingSource"] = "default";

  if (args.formId) {
    const { data: routes } = await admin
      .from("meta_lead_form_routes")
      .select("pipeline_id, stage_id")
      .eq("sub_account_id", args.subAccountId)
      .eq("form_id", args.formId)
      .limit(1);
    const route = (routes ?? [])[0] as { pipeline_id: string; stage_id: string } | undefined;
    if (route) {
      const { data: routedPipes } = await admin
        .from("pipelines")
        .select("id, owner_id")
        .eq("id", route.pipeline_id)
        .eq("sub_account_id", args.subAccountId)
        .limit(1);
      const routedPipe = (routedPipes ?? [])[0] as { id: string; owner_id: string } | undefined;
      if (routedPipe) {
        const { data: routedStages } = await admin
          .from("pipeline_stages")
          .select("id")
          .eq("id", route.stage_id)
          .eq("pipeline_id", routedPipe.id)
          .limit(1);
        const routedStage = (routedStages ?? [])[0] as { id: string } | undefined;
        if (routedStage) {
          pipeline = routedPipe;
          stage = routedStage;
          routingSource = "mapped";
        }
      }
    }
  }

  if (!pipeline || !stage) {
    routingSource = "default";
    const { data: pipes } = await admin
      .from("pipelines")
      .select("id, owner_id")
      .eq("sub_account_id", args.subAccountId)
      .order("created_at", { ascending: true })
      .limit(1);
    pipeline = (pipes ?? [])[0] as { id: string; owner_id: string } | undefined;
    if (!pipeline) {
      return { dealId: null, pipelineId: null, stageId: null, routingSource: "none", duplicate: false, error: "No pipeline exists in this workspace" };
    }

    const { data: stages } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true })
      .limit(1);
    stage = (stages ?? [])[0] as { id: string } | undefined;
    if (!stage) {
      return { dealId: null, pipelineId: pipeline.id, stageId: null, routingSource: "none", duplicate: false, error: "The default pipeline has no stages" };
    }
  }

  if (args.contactId) {
    const { data: dupe } = await admin
      .from("deals")
      .select("id, pipeline_id, stage_id")
      .eq("sub_account_id", args.subAccountId)
      .eq("contact_id", args.contactId)
      .limit(1);
    const existing = (dupe ?? [])[0] as { id: string; pipeline_id: string; stage_id: string } | undefined;
    if (existing?.id) {
      return {
        dealId: existing.id,
        pipelineId: existing.pipeline_id,
        stageId: existing.stage_id,
        routingSource,
        duplicate: true,
      };
    }
  }

  const { data: created, error } = await admin
    .from("deals")
    .insert({
      sub_account_id: args.subAccountId,
      owner_id: pipeline.owner_id,
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      contact_id: args.contactId,
      title: args.title,
      notes: `Auto-created from ${args.source}`,
    })
    .select("id")
    .single();
  if (error) {
    console.error("createOpportunityForLead failed", error);
    return {
      dealId: null,
      pipelineId: pipeline.id,
      stageId: stage.id,
      routingSource,
      duplicate: false,
      error: error.message ?? String(error),
    };
  }
  return { dealId: created.id as string, pipelineId: pipeline.id, stageId: stage.id, routingSource, duplicate: false };
}

/** Append one row to the Lead Ad audit trail. Never throws. */
export async function recordLeadAdEvent(
  admin: { from: (t: string) => any },
  row: {
    subAccountId: string;
    pageId?: string | null;
    formId?: string | null;
    formName?: string | null;
    leadgenId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    pipelineId?: string | null;
    stageId?: string | null;
    routingSource?: string;
    status?: string;
    error?: string | null;
    isTest?: boolean;
    leadFields?: Record<string, unknown>;
    payload?: unknown;
  },
): Promise<void> {
  try {
    await admin.from("meta_lead_ad_events").insert({
      sub_account_id: row.subAccountId,
      page_id: row.pageId ?? null,
      form_id: row.formId ?? null,
      form_name: row.formName ?? null,
      leadgen_id: row.leadgenId ?? null,
      contact_id: row.contactId ?? null,
      deal_id: row.dealId ?? null,
      pipeline_id: row.pipelineId ?? null,
      stage_id: row.stageId ?? null,
      routing_source: row.routingSource ?? "default",
      status: row.status ?? "ok",
      error: row.error ?? null,
      is_test: row.isTest ?? false,
      lead_fields: row.leadFields ?? {},
      payload: row.payload ?? {},
    });
  } catch (e) {
    console.error("recordLeadAdEvent failed", e);
  }
}

/**
 * Single ingestion path for a Lead Ad lead (live webhook or replayed test).
 * Upserts the contact by meta_lead_id, creates/reuses the opportunity using the
 * form's pipeline/stage mapping, and writes an audit-trail row either way.
 */
export async function ingestLeadAdLead(
  admin: { from: (t: string) => any },
  args: {
    subAccountId: string;
    ownerId: string;
    pageId?: string | null;
    formId?: string | null;
    formName?: string | null;
    leadgenId: string;
    fields: Record<string, string>;
    payload?: unknown;
    isTest?: boolean;
  },
): Promise<LeadRoutingResult & { contactId: string | null }> {
  const f = args.fields;
  const pick = (test: (k: string) => boolean) => {
    for (const [k, v] of Object.entries(f)) {
      if (v && test(k.toLowerCase())) return String(v);
    }
    return null;
  };
  const email = f["email"] ?? pick((k) => k.includes("email"));
  const phone =
    f["phone_number"] ?? f["phone"] ?? pick((k) => k.includes("phone") || k.includes("mobile"));
  const full = f["full_name"] ? String(f["full_name"]) : pick((k) => k === "name" || k.includes("full_name"));
  const first = f["first_name"] ?? (full ? full.split(" ")[0] : null);
  const last = f["last_name"] ?? (full ? full.split(" ").slice(1).join(" ") : null);


  const audit = (extra: Partial<Parameters<typeof recordLeadAdEvent>[1]>) =>
    recordLeadAdEvent(admin, {
      subAccountId: args.subAccountId,
      pageId: args.pageId ?? null,
      formId: args.formId ?? null,
      formName: args.formName ?? null,
      leadgenId: args.leadgenId,
      isTest: args.isTest ?? false,
      leadFields: f,
      payload: args.payload ?? {},
      ...extra,
    });

  const { data: existingRows } = await admin
    .from("contacts")
    .select("id")
    .eq("sub_account_id", args.subAccountId)
    .eq("meta_lead_id", args.leadgenId)
    .limit(1);
  let contactId = (existingRows ?? [])[0]?.id as string | undefined;

  const patch = {
    first_name: first,
    last_name: last,
    email,
    phone,
    lead_source: "meta_lead_ads",
    lifecycle_stage: "lead",
  };

  if (contactId) {
    await admin.from("contacts").update(patch).eq("id", contactId);
  } else {
    const { data: created, error: cErr } = await admin
      .from("contacts")
      .insert({
        ...patch,
        sub_account_id: args.subAccountId,
        owner_id: args.ownerId,
        meta_lead_id: args.leadgenId,
        tags: [],
      })
      .select("id")
      .single();
    if (cErr) {
      await audit({ status: "error", error: `Contact insert failed: ${cErr.message ?? String(cErr)}`, routingSource: "none" });
      return { contactId: null, dealId: null, pipelineId: null, stageId: null, routingSource: "none", duplicate: false, error: cErr.message };
    }
    contactId = created.id as string;
  }

  const title = [first, last].filter(Boolean).join(" ").trim() || email || phone || "Facebook lead";
  const result = await createOpportunityForLead(admin, {
    subAccountId: args.subAccountId,
    contactId: contactId ?? null,
    title,
    source: args.isTest ? "Facebook Lead Ad (test replay)" : "Facebook Lead Ad",
    formId: args.formId ?? null,
  });

  await audit({
    contactId: contactId ?? null,
    dealId: result.dealId,
    pipelineId: result.pipelineId,
    stageId: result.stageId,
    routingSource: result.routingSource,
    status: result.error ? "error" : result.duplicate ? "duplicate" : "ok",
    error: result.error ?? null,
  });

  return { ...result, contactId: contactId ?? null };
}

/**
 * Health-check a stored user access token by asking Meta who it belongs to.
 * User tokens die quietly (password change, permission removal, 60-day
 * inactivity, expiry) — when that happens leads and DMs simply stop arriving,
 * so we surface it as a "reconnect" prompt instead of silence.
 */
export type MetaTokenHealth = {
  status: "ok" | "expired" | "revoked" | "error";
  message?: string;
  metaUserName?: string;
  expiresAt?: string | null;
  daysUntilExpiry?: number | null;
  expiringSoon: boolean;
  needsReconnect: boolean;
};

export async function checkTokenHealth(
  token: string,
  expiresAt?: string | null,
): Promise<MetaTokenHealth> {
  const days =
    expiresAt ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const expiringSoon = days !== null && days <= 7;
  try {
    const me = await fetchMe(token);
    return {
      status: "ok",
      metaUserName: me.name,
      expiresAt: expiresAt ?? null,
      daysUntilExpiry: days,
      expiringSoon,
      needsReconnect: expiringSoon || (days !== null && days <= 0),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lowered = msg.toLowerCase();
    const status: MetaTokenHealth["status"] = lowered.includes("expired")
      ? "expired"
      : lowered.includes("session") || lowered.includes("oauth") || lowered.includes("190")
        ? "revoked"
        : "error";
    return {
      status,
      message: msg,
      expiresAt: expiresAt ?? null,
      daysUntilExpiry: days,
      expiringSoon,
      needsReconnect: true,
    };
  }
}
