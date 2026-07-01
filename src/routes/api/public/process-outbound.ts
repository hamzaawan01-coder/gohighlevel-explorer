import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint for pg_cron / external schedulers to drain the outbound_messages queue.
 * Protected by the Supabase anon key in an `apikey` header — that matches
 * `SUPABASE_PUBLISHABLE_KEY` at runtime.
 */
export const Route = createFileRoute("/api/public/process-outbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
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
      GET: async () => Response.json({ ok: true, hint: "POST with apikey header to drain" }),
    },
  },
});
