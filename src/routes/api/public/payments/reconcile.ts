import { createFileRoute } from "@tanstack/react-router";
import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Scheduled reconciliation endpoint (pg_cron / external scheduler).
 * /api/public/* bypasses edge auth, so the caller is authorized here with the
 * CRON_SECRET or the publishable key.
 */
export const Route = createFileRoute("/api/public/payments/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-api-key") ?? request.headers.get("apikey");
        const secret = process.env["CRON_SECRET"];
        const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const ok = !!provided && ((secret && provided === secret) || (anon && provided === anon));
        if (!ok) return new Response("unauthorized", { status: 401 });

        const rawEnv = new URL(request.url).searchParams.get("env");
        const env: StripeEnv = rawEnv === "live" ? "live" : "sandbox";
        try {
          const { reconcileSubscriptions } = await import("@/lib/billing-reconcile.server");
          const result = await reconcileSubscriptions(env);
          return Response.json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Billing reconcile failed:", msg);
          return new Response(msg, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST with x-api-key to reconcile subscriptions" }),
    },
  },
});
