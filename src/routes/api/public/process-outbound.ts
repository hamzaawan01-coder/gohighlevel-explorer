import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint for pg_cron / external schedulers to drain the outbound_messages queue.
 * Accepts either the Supabase publishable/anon key OR the CRON_SECRET in the
 * `x-api-key` / `apikey` header. /api/public/* already bypasses auth at the edge,
 * so we authorize the caller here.
 */
export const Route = createFileRoute("/api/public/process-outbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-api-key") ?? request.headers.get("apikey");
        const secret = process.env.CRON_SECRET;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const ok = !!provided && ((secret && provided === secret) || (anon && provided === anon));
        if (!ok) return new Response("unauthorized", { status: 401 });
        const { drainAll } = await import("@/lib/integrations.server-queue");
        const { enqueueDueReminders } = await import("@/lib/appointments.server");
        const { runOverdueInvoiceReminders } = await import("@/lib/invoices.server");
        try {
          let reminders: Awaited<ReturnType<typeof enqueueDueReminders>> | { error: string };
          try {
            reminders = await enqueueDueReminders();
          } catch (e) {
            reminders = { error: e instanceof Error ? e.message : String(e) };
          }
          let invoiceReminders:
            | Awaited<ReturnType<typeof runOverdueInvoiceReminders>>
            | { error: string };
          try {
            invoiceReminders = await runOverdueInvoiceReminders();
          } catch (e) {
            invoiceReminders = { error: e instanceof Error ? e.message : String(e) };
          }
          const result = await drainAll();
          return Response.json({ ...result, reminders, invoiceReminders });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(msg, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST with x-api-key header to drain" }),
    },
  },
});
