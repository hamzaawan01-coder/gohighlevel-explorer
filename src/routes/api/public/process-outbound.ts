import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint for pg_cron / external schedulers to drain the outbound_messages queue.
 * Protected by a dedicated CRON_SECRET (never the Supabase anon key, which ships in the
 * client bundle). Callers must pass it in the `x-api-key` (or `apikey`) header.
 */
export const Route = createFileRoute("/api/public/process-outbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-api-key") ?? request.headers.get("apikey");
        const expected = process.env.CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { drainAll } = await import("@/lib/integrations.server-queue");
        try {
          const result = await drainAll();
          return Response.json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(msg, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST with x-api-key header to drain" }),
    },
  },
});
