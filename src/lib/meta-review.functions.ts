import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { publicOrigin } from "./meta.server";

async function ensureSubAccess(supabase: any, userId: string, subId: string) {
  const { data, error } = await supabase.rpc("has_subaccount_access", { _user: userId, _sub: subId });
  if (error || !data) throw new Error("Forbidden: no access to this workspace");
}

/**
 * App Review readiness: the URLs Meta needs, whether the app secret is present,
 * a live health probe of the deletion callback, and the last completed request.
 */
export const getAppReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);

    const origin = publicOrigin();
    const urls = {
      privacyPolicyUrl: `${origin}/privacy`,
      termsUrl: `${origin}/terms`,
      dataDeletionCallbackUrl: `${origin}/api/public/meta/data-deletion`,
      dataDeletionStatusUrl: `${origin}/data-deletion`,
    };

    const config = {
      appIdConfigured: Boolean(process.env.META_APP_ID),
      appSecretConfigured: Boolean(process.env.META_APP_SECRET),
      webhookVerifyTokenConfigured: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    };

    // Live health probes (HEAD-ish GETs). The callback is healthy when it
    // rejects an unknown code with 404 rather than erroring out.
    async function probe(url: string, okStatuses: number[]) {
      const started = Date.now();
      try {
        const res = await fetch(url, { method: "GET" });
        return { url, status: res.status, ok: okStatuses.includes(res.status), ms: Date.now() - started };
      } catch (e) {
        return { url, status: 0, ok: false, ms: Date.now() - started, error: (e as Error).message };
      }
    }

    const [privacy, terms, callback] = await Promise.all([
      probe(urls.privacyPolicyUrl, [200]),
      probe(urls.termsUrl, [200]),
      probe(`${urls.dataDeletionCallbackUrl}?code=healthcheck-unknown`, [404]),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("meta_deletion_requests")
      .select("confirmation_code, status, created_at, deleted_counts")
      .order("created_at", { ascending: false })
      .limit(5);

    const recent = (rows ?? []) as Array<{
      confirmation_code: string;
      status: string;
      created_at: string;
      deleted_counts: Record<string, number>;
    }>;
    const lastSuccessful = recent.find((r) => r.status === "completed") ?? null;

    return {
      urls,
      config,
      health: { privacy, terms, callback },
      lastSuccessfulCallbackAt: lastSuccessful?.created_at ?? null,
      lastSuccessfulCode: lastSuccessful?.confirmation_code ?? null,
      recent,
    };
  });

/**
 * End-to-end verification of the data deletion callback. Either verify a
 * pasted signed_request, or generate a valid test one for a given Meta user id
 * and POST it to the live endpoint, returning the computed confirmation_code.
 */
export const testDataDeletionCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; signedRequest?: string; metaUserId?: string }) =>
    z
      .object({
        subAccountId: z.string().uuid(),
        signedRequest: z.string().max(4000).optional(),
        metaUserId: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSubAccess(context.supabase, context.userId, data.subAccountId);

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) throw new Error("META_APP_SECRET is not configured yet.");

    const { createHmac } = await import("crypto");

    let signedRequest = data.signedRequest?.trim() || "";
    let generated = false;

    if (!signedRequest) {
      const userId = data.metaUserId?.trim() || `test-${Date.now()}`;
      const payload = Buffer.from(
        JSON.stringify({
          algorithm: "HMAC-SHA256",
          issued_at: Math.floor(Date.now() / 1000),
          user_id: userId,
        }),
      ).toString("base64url");
      const sig = createHmac("sha256", appSecret).update(payload).digest("base64url");
      signedRequest = `${sig}.${payload}`;
      generated = true;
    }

    // Decode locally so we can report what Meta would have sent.
    let decodedUserId: string | null = null;
    try {
      const payloadPart = signedRequest.split(".")[1] ?? "";
      const json = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
      decodedUserId = json?.user_id ? String(json.user_id) : null;
    } catch {
      decodedUserId = null;
    }

    const endpoint = `${publicOrigin()}/api/public/meta/data-deletion`;
    const body = new URLSearchParams({ signed_request: signedRequest });
    const started = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await res.text();
    let parsed: { url?: string; confirmation_code?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return {
      endpoint,
      generated,
      signedRequest,
      decodedUserId,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      confirmationCode: parsed?.confirmation_code ?? null,
      statusUrl: parsed?.url ?? null,
      raw: text.slice(0, 2000),
    };
  });
