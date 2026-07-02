// Twilio Phone System — server helpers (server-only)
// Uses per-connection Basic auth (API Key SID + Secret over Account SID scope).

type TwilioAuth = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
};

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";
const TWILIO_PRICING_BASE = "https://pricing.twilio.com/v1";
const TWILIO_MESSAGING_BASE = "https://messaging.twilio.com/v1";

function authHeader(a: TwilioAuth) {
  const token = Buffer.from(`${a.apiKeySid}:${a.apiKeySecret}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function twilioRequest(
  method: string,
  url: string,
  auth: TwilioAuth,
  body?: Record<string, string | undefined>,
) {
  const init: RequestInit = { method, headers: { ...authHeader(auth) } };
  if (body) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) if (v !== undefined) form.append(k, v);
    init.body = form.toString();
    (init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {
    // XML or empty
  }
  if (!res.ok) {
    const msg = json?.message || json?.detail || text || `Twilio HTTP ${res.status}`;
    const code = json?.code ? ` [code ${json.code}]` : "";
    throw new Error(`Twilio ${res.status}${code}: ${msg}`);
  }
  return json;
}

/** Verify credentials by fetching the account resource. */
export async function verifyTwilioCredentials(auth: TwilioAuth) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}.json`;
  const res = await twilioRequest("GET", url, auth);
  return {
    friendlyName: res.friendly_name as string,
    status: res.status as string,
    type: res.type as string,
  };
}

/** Search available phone numbers to buy. */
export async function searchAvailableNumbers(
  auth: TwilioAuth,
  params: {
    isoCountry: string;
    type?: "Local" | "TollFree" | "Mobile";
    areaCode?: string;
    contains?: string;
    smsEnabled?: boolean;
    mmsEnabled?: boolean;
    voiceEnabled?: boolean;
    limit?: number;
  },
) {
  const type = params.type ?? "Local";
  const qs = new URLSearchParams();
  if (params.areaCode) qs.set("AreaCode", params.areaCode);
  if (params.contains) qs.set("Contains", params.contains);
  if (params.smsEnabled) qs.set("SmsEnabled", "true");
  if (params.mmsEnabled) qs.set("MmsEnabled", "true");
  if (params.voiceEnabled) qs.set("VoiceEnabled", "true");
  qs.set("PageSize", String(params.limit ?? 20));
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/AvailablePhoneNumbers/${params.isoCountry}/${type}.json?${qs.toString()}`;
  const res = await twilioRequest("GET", url, auth);
  return (res.available_phone_numbers ?? []) as Array<{
    friendly_name: string;
    phone_number: string;
    locality: string | null;
    region: string | null;
    iso_country: string;
    capabilities: { voice?: boolean; SMS?: boolean; MMS?: boolean; fax?: boolean };
  }>;
}

/** Fetch monthly rental price for a country. Returns first phone_number_price. */
export async function getNumberPrice(auth: TwilioAuth, isoCountry: string, type = "local") {
  try {
    const url = `${TWILIO_PRICING_BASE}/PhoneNumbers/Countries/${isoCountry}`;
    const res = await twilioRequest("GET", url, auth);
    const prices = res?.phone_number_prices ?? [];
    const match = prices.find((p: any) => (p.number_type as string).toLowerCase() === type) ?? prices[0];
    return match
      ? { monthly: Number(match.base_price), currency: res.price_unit as string }
      : null;
  } catch {
    return null;
  }
}

/** Purchase a phone number and configure webhooks. */
export async function purchaseNumber(
  auth: TwilioAuth,
  input: { phoneNumber: string; friendlyName?: string; voiceUrl?: string; smsUrl?: string; statusCallback?: string },
) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/IncomingPhoneNumbers.json`;
  const res = await twilioRequest("POST", url, auth, {
    PhoneNumber: input.phoneNumber,
    FriendlyName: input.friendlyName,
    VoiceUrl: input.voiceUrl,
    VoiceMethod: input.voiceUrl ? "POST" : undefined,
    SmsUrl: input.smsUrl,
    SmsMethod: input.smsUrl ? "POST" : undefined,
    StatusCallback: input.statusCallback,
    StatusCallbackMethod: input.statusCallback ? "POST" : undefined,
  });
  return {
    sid: res.sid as string,
    phoneNumber: res.phone_number as string,
    friendlyName: res.friendly_name as string,
    capabilities: res.capabilities as Record<string, boolean>,
    isoCountry: (res.iso_country ?? null) as string | null,
  };
}

/** Release (delete) a purchased number. */
export async function releaseNumber(auth: TwilioAuth, sid: string) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/IncomingPhoneNumbers/${sid}.json`;
  await twilioRequest("DELETE", url, auth);
}

/** Update webhook URLs on an existing number. */
export async function updateNumberWebhooks(
  auth: TwilioAuth,
  sid: string,
  input: { voiceUrl?: string; smsUrl?: string; statusCallback?: string; friendlyName?: string },
) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/IncomingPhoneNumbers/${sid}.json`;
  const res = await twilioRequest("POST", url, auth, {
    VoiceUrl: input.voiceUrl,
    VoiceMethod: input.voiceUrl ? "POST" : undefined,
    SmsUrl: input.smsUrl,
    SmsMethod: input.smsUrl ? "POST" : undefined,
    StatusCallback: input.statusCallback,
    StatusCallbackMethod: input.statusCallback ? "POST" : undefined,
    FriendlyName: input.friendlyName,
  });
  return res;
}

export function webhookBaseUrl() {
  // Use the stable published origin when available; fall back to preview
  return process.env.PUBLIC_APP_URL ?? "https://gohighlevel-explorer.lovable.app";
}

export function voiceWebhookUrl(token: string) {
  return `${webhookBaseUrl()}/api/public/twilio/${token}/voice`;
}
export function smsWebhookUrl(token: string) {
  return `${webhookBaseUrl()}/api/public/twilio/${token}/sms`;
}
export function statusWebhookUrl(token: string) {
  return `${webhookBaseUrl()}/api/public/twilio/${token}/status`;
}

/** Send an SMS or MMS via Twilio Messages API. */
export async function sendSmsMessage(
  auth: TwilioAuth,
  input: { from: string; to: string; body: string; mediaUrls?: string[]; statusCallback?: string },
) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/Messages.json`;
  const form: Record<string, string | undefined> = {
    From: input.from,
    To: input.to,
    Body: input.body,
    StatusCallback: input.statusCallback,
  };
  const res = await twilioRequest("POST", url, auth, form);
  // MediaUrl must be sent as repeated form field — send a follow-up if needed
  // Actually we need to include MediaUrl in the same request. Use a manual form build.
  return {
    sid: res.sid as string,
    status: res.status as string,
    numSegments: res.num_segments as string | undefined,
  };
}

/** Send with optional MMS media (supports repeated MediaUrl fields). */
export async function sendMessageWithMedia(
  auth: TwilioAuth,
  input: { from: string; to: string; body: string; mediaUrls?: string[]; statusCallback?: string },
) {
  const url = `${TWILIO_BASE}/Accounts/${auth.accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.append("From", input.from);
  form.append("To", input.to);
  form.append("Body", input.body);
  if (input.statusCallback) form.append("StatusCallback", input.statusCallback);
  for (const u of input.mediaUrls ?? []) form.append("MediaUrl", u);
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeader(auth), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = json?.message || text || `Twilio HTTP ${res.status}`;
    throw new Error(`Twilio ${res.status}: ${msg}`);
  }
  return {
    sid: json.sid as string,
    status: json.status as string,
  };
}
