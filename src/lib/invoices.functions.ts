import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Email the branded invoice to the client contact and log delivery. */
export const sendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; to?: string | null }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true; to: string } | { error: string }> => {
    const { supabase, userId } = context;
    // RLS check: the caller must be able to see the invoice.
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id,sub_account_id")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !inv) return { error: "Invoice not found or not accessible" };

    try {
      const { queueInvoiceEmail } = await import("@/lib/invoices.server");
      const result = await queueInvoiceEmail({
        invoiceId: data.invoiceId,
        toOverride: data.to ?? null,
        actor: userId,
      });
      return { ok: true, to: result.to };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const { logInvoiceEventServer } = await import("@/lib/invoices.server");
      await logInvoiceEventServer({
        invoiceId: data.invoiceId,
        subAccountId: (inv as { sub_account_id: string }).sub_account_id,
        type: "send_failed",
        detail: { error: msg },
        actor: userId,
      });
      return { error: msg };
    }
  });

/** Create (or reuse) a Stripe payment link so the client can pay online. */
export const createInvoicePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; environment: "sandbox" | "live" }) => data)
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id,sub_account_id,number,currency,total,stripe_payment_link_url,status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !inv) return { error: "Invoice not found or not accessible" };
    const invoice = inv as unknown as {
      id: string;
      sub_account_id: string;
      number: string;
      currency: string;
      total: number;
      stripe_payment_link_url: string | null;
    };
    if (invoice.stripe_payment_link_url) return { url: invoice.stripe_payment_link_url };
    if (!invoice.total || Number(invoice.total) <= 0) {
      return { error: "Add line items before creating a payment link." };
    }

    try {
      const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(data.environment);
      const currency = (invoice.currency || "GBP").toLowerCase();
      const zeroDecimal = ["jpy", "krw", "vnd", "clp"].includes(currency);
      const unitAmount = Math.round(Number(invoice.total) * (zeroDecimal ? 1 : 100));

      let url: string;
      try {
        const price = await stripe.prices.create({
          currency,
          unit_amount: unitAmount,
          product_data: { name: `Invoice ${invoice.number}` },
        });
        const link = await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: { invoiceId: invoice.id, subAccountId: invoice.sub_account_id },
          payment_intent_data: {
            metadata: { invoiceId: invoice.id, subAccountId: invoice.sub_account_id },
          },
        });
        url = link.url;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("invoices")
          .update({ stripe_payment_link_url: url, stripe_payment_link_id: link.id } as never)
          .eq("id", invoice.id);
      } catch (stripeError) {
        return { error: getStripeErrorMessage(stripeError) };
      }

      const { logInvoiceEventServer } = await import("@/lib/invoices.server");
      await logInvoiceEventServer({
        invoiceId: invoice.id,
        subAccountId: invoice.sub_account_id,
        type: "payment_link_created",
        detail: { url, environment: data.environment },
        actor: userId,
      });
      return { url };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

/**
 * Resend one or more invoices as branded emails, optionally forcing a specific
 * template version. Each delivery is recorded in the invoice history.
 */
export const bulkResendInvoiceEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceIds: string[]; templateId?: string | null }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      sent: Array<{ invoiceId: string; number: string; to: string }>;
      failed: Array<{ invoiceId: string; number: string; error: string }>;
    }> => {
      const { supabase, userId } = context;
      const ids = [...new Set(data.invoiceIds)].slice(0, 100);
      const sent: Array<{ invoiceId: string; number: string; to: string }> = [];
      const failed: Array<{ invoiceId: string; number: string; error: string }> = [];
      if (!ids.length) return { sent, failed };

      // RLS check — only invoices the caller can actually see.
      const { data: rows } = await supabase
        .from("invoices")
        .select("id,number,sub_account_id")
        .in("id", ids);
      const visible = (rows ?? []) as Array<{ id: string; number: string; sub_account_id: string }>;

      const { queueInvoiceEmail, logInvoiceEventServer } = await import("@/lib/invoices.server");
      for (const inv of visible) {
        try {
          const result = await queueInvoiceEmail({
            invoiceId: inv.id,
            actor: userId,
            templateId: data.templateId ?? null,
            resend: true,
          });
          sent.push({ invoiceId: inv.id, number: inv.number, to: result.to });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logInvoiceEventServer({
            invoiceId: inv.id,
            subAccountId: inv.sub_account_id,
            type: "send_failed",
            detail: { error: msg, resend: true, template_id: data.templateId ?? null },
            actor: userId,
          });
          failed.push({ invoiceId: inv.id, number: inv.number, error: msg });
        }
      }
      return { sent, failed };
    },
  );
