// Twilio Voice helpers — access token JWT + TwiML app + TwiML rendering.
// JWT uses `jose` (Web Crypto). Runs in the Worker runtime.
import { SignJWT } from "jose";

type Auth = { accountSid: string; apiKeySid: string; apiKeySecret: string };

const BASE = "https://api.twilio.com/2010-04-01";

/** Create or update a TwiML application used by the browser dialer. */
export async function createTwimlApp(
  auth: Auth,
  input: { friendlyName: string; voiceUrl: string; statusCallback?: string; existingSid?: string | null },
) {
  const body = new URLSearchParams();
  body.set("FriendlyName", input.friendlyName);
  body.set("VoiceUrl", input.voiceUrl);
  body.set("VoiceMethod", "POST");
  if (input.statusCallback) {
    body.set("StatusCallback", input.statusCallback);
    body.set("StatusCallbackMethod", "POST");
  }
  const url = input.existingSid
    ? `${BASE}/Accounts/${auth.accountSid}/Applications/${input.existingSid}.json`
    : `${BASE}/Accounts/${auth.accountSid}/Applications.json`;
  const authHeader = "Basic " + Buffer.from(`${auth.apiKeySid}:${auth.apiKeySecret}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`Twilio TwiML app ${res.status}: ${json?.message ?? text}`);
  return { sid: json.sid as string, friendlyName: json.friendly_name as string };
}

/** Build a Twilio Voice Access Token JWT. Valid for `ttlSeconds` (default 1h). */
export async function buildVoiceAccessToken(
  auth: Auth,
  input: { identity: string; twimlAppSid: string; ttlSeconds?: number },
) {
  const ttl = input.ttlSeconds ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: `${auth.apiKeySid}-${now}`,
    grants: {
      identity: input.identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: input.twimlAppSid },
      },
    },
  } as const;
  const secret = new TextEncoder().encode(auth.apiKeySecret);
  const jwt = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" } as any)
    .setIssuer(auth.apiKeySid)
    .setSubject(auth.accountSid)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + ttl)
    .sign(secret);
  return { token: jwt, identity: input.identity, expiresAt: now + ttl };
}

export function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
