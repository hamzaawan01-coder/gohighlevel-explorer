import { createHmac } from "crypto";

export function signOauthState(payload: Record<string, string>): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOauthState(state: string): Record<string, string> | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Number(p.exp) < Date.now()) return null;
    return p;
  } catch { return null; }
}
