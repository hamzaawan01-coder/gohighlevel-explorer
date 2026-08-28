/**
 * Server-only helpers for Meta Graph API (Facebook / Instagram / Ads).
 * Never import from route/component code — call via createServerFn wrappers.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "pages_manage_ads",
  "leads_retrieval",
  "ads_read",
  "ads_management",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "business_management",
] as const;

export function publicOrigin(): string {
  return process.env.PUBLIC_SITE_URL || "https://gohighlevel-explorer.lovable.app";
}

export function metaRedirectUri(): string {
  return `${publicOrigin()}/api/public/oauth/meta/callback`;
}

export function metaWebhookUrl(token: string): string {
  return `${publicOrigin()}/api/public/hooks/meta/${encodeURIComponent(token)}`;
}

export function buildAuthorizeUrl(state: string): string {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID is not configured");
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", metaRedirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", META_SCOPES.join(","));
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

export type MetaPageDTO = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  instagram_business_account?: { id: string };
};

export async function fetchUserPages(token: string): Promise<MetaPageDTO[]> {
  const r = await graph<{ data: MetaPageDTO[] }>(
    "/me/accounts",
    { fields: "id,name,access_token,category,instagram_business_account", limit: "200" },
    token,
  );
  return r.data ?? [];
}

export type MetaAdAccountDTO = {
  id: string; // act_...
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

export async function fetchUserAdAccounts(token: string): Promise<MetaAdAccountDTO[]> {
  const r = await graph<{ data: MetaAdAccountDTO[] }>(
    "/me/adaccounts",
    { fields: "id,name,currency,timezone_name,account_status", limit: "200" },
    token,
  );
  return r.data ?? [];
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

/** Subscribe a page to the app for leadgen + messages webhooks. Requires page access token. */
export async function subscribePageToApp(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("subscribed_fields", "leadgen,messages,messaging_postbacks,message_reads");
  const res = await fetch(url.toString(), { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(`Subscribe page failed: ${body.error?.message ?? res.status}`);
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
