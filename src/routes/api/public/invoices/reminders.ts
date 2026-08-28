import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled overdue-invoice reminder run (pg_cron / external scheduler).
 * /api/public/* bypasses edge auth, so the caller is authorized here with the
 * CRON_SECRET or the publishable key.
 */
export const Route = createFileRoute("/api/public/invoices/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-api-key") ?? request.headers.get("apikey");
        const secret = process.env["CRON_SECRET"];
        const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const ok = !!provided && ((secret && provided === secret) || (anon && provided === anon));
        if (!ok) return new Response("unauthorized", { status: 401 });
        try {
          const { runOverdueInvoiceReminders } = await import("@/lib/invoices.server");
          return Response.json(await runOverdueInvoiceReminders());
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Invoice reminders failed:", msg);
          return new Response(msg, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST with x-api-key to run overdue invoice reminders" }),
    },
  },
});
