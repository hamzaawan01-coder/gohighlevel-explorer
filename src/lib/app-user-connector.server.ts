/**
 * Per-end-user connector plumbing (App User Connectors).
 *
 * Server-only: reads LOVABLE_API_KEY and the connection encryption key from
 * process.env, so it must never be imported from route/component code. Server
 * functions import it; the `.server.ts` suffix keeps it out of client bundles.
 *
 * Each CRM user links their own mailbox. The gateway hands us a per-user
 * connection key (`lovack_*`) which we store encrypted against their user id.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export type MailConnectorId = "google_mail" | "microsoft_outlook";

function requireApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured on the server.");
  return key;
}

/** Client API key of the workspace connector client linked to this project. */
export function clientApiKeyFor(connectorId: MailConnectorId): string {
  const name =
    connectorId === "google_mail"
      ? "GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"
      : "MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY";
  const value = process.env[name];
  if (!value) {
    throw new Error(
      connectorId === "google_mail"
        ? "Gmail is not set up yet for this workspace."
        : "Outlook is not set up yet for this workspace.",
    );
  }
  return value;
}

/* ------------------------------------------------------------------ crypto */

function encryptionKey(): Buffer {
  const raw = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set.");
  return Buffer.from(raw, "base64");
}

export function encryptConnectionKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptConnectionKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/* ----------------------------------------------------------------- storage */

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: MailConnectorId,
  connectionAPIKey: string,
  accountEmail?: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      account_email: accountEmail ?? null,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(
  userId: string,
  connectorId: MailConnectorId,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function listConnectionsForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connector_id, account_email, updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function deleteConnectionForUser(userId: string, connectorId: MailConnectorId) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

export async function setAccountEmail(
  userId: string,
  connectorId: MailConnectorId,
  email: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_user_connections")
    .update({ account_email: email })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

/* ------------------------------------------------------------------ gateway */

export async function authorizeAppUserOAuth(params: {
  connectorId: MailConnectorId;
  appUserId: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
  connectionAPIKey?: string;
}): Promise<{ authorizationUrl: string; sessionId: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": clientApiKeyFor(params.connectorId),
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;

  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mailbox sign-in could not start (${res.status}): ${text}`);
  const body = JSON.parse(text || "{}") as { authorization_url?: string; session_id?: string };
  if (!body.authorization_url) throw new Error("Mailbox sign-in returned no authorization URL.");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export async function exchangeAppUserOAuthCode(
  code: string,
): Promise<{ connectionAPIKey: string; connectorId: string }> {
  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mailbox sign-in could not finish (${res.status}): ${text}`);
  const body = JSON.parse(text || "{}") as { api_key?: string; connector_id?: string };
  if (!body.api_key || !body.connector_id) {
    throw new Error("Mailbox sign-in returned an incomplete result.");
  }
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}

export async function callAsAppUser(params: {
  connectorId: MailConnectorId;
  connectionAPIKey: string;
  path: string;
  init?: RequestInit;
}): Promise<Response> {
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const headers = new Headers(params.init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", params.connectionAPIKey);
  return fetch(`${GATEWAY_BASE_URL}/${params.connectorId}${path}`, { ...params.init, headers });
}

export async function disconnectAppUser(params: {
  connectorId: MailConnectorId;
  connectionAPIKey: string;
}): Promise<void> {
  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "X-Connection-Api-Key": params.connectionAPIKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connector_id: params.connectorId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Disconnect failed (${res.status}): ${text}`);
  }
}
