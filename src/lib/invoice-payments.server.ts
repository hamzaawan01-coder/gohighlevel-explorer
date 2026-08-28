/**
 * Stripe → invoice synchronisation. Pure application logic with a small db
 * surface so it can be exercised with a fake client in tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type InvoicePaymentDb = {
  markPaid(input: {
    invoiceId: string;
    amountPaid: number;
    paymentIntentId: string | null;
    checkoutSessionId: string | null;
    paidAt: string;
  }): Promise<{ subAccountId: string } | null>;
  logEvent(input: {
    invoiceId: string;
    subAccountId: string;
    type: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
};

export type InvoicePaymentResult =
  | { applied: true; invoiceId: string }
  | { applied: false; reason: string };

/** Zero-decimal currencies keep amounts in the major unit already. */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function toMajorUnit(amount: number | null | undefined, currency: string | null | undefined): number {
  const value = amount ?? 0;
  const c = (currency ?? "").toLowerCase();
  return ZERO_DECIMAL.has(c) ? value : value / 100;
}

function invoiceIdFrom(object: any): string | null {
  return (
    object?.metadata?.invoiceId ??
    object?.payment_intent?.metadata?.invoiceId ??
    null
  );
}

/**
 * Apply a Stripe payment event to an invoice. Unrelated events and payments
 * without invoice metadata are reported as skipped, never thrown, so the
 * webhook still answers 200.
 */
export async function applyInvoicePaymentEvent(
  event: { type: string; data: { object: any } },
  db: InvoicePaymentDb,
): Promise<InvoicePaymentResult> {
  const object = event.data?.object;

  if (event.type === "checkout.session.completed") {
    if (object?.payment_status === "unpaid") return { applied: false, reason: "checkout not settled yet" };
  } else if (
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "payment_intent.succeeded"
  ) {
    return { applied: false, reason: `unrelated event ${event.type}` };
  }

  const invoiceId = invoiceIdFrom(object);
  if (!invoiceId) return { applied: false, reason: "no invoiceId metadata" };

  const isSession = String(event.type).startsWith("checkout.session");
  const amount = isSession ? (object?.amount_total ?? object?.amount_subtotal) : object?.amount_received;
  const paymentIntentId = isSession
    ? typeof object?.payment_intent === "string"
      ? object.payment_intent
      : (object?.payment_intent?.id ?? null)
    : (object?.id ?? null);

  const row = await db.markPaid({
    invoiceId,
    amountPaid: toMajorUnit(amount, object?.currency),
    paymentIntentId,
    checkoutSessionId: isSession ? (object?.id ?? null) : null,
    paidAt: new Date().toISOString(),
  });
  if (!row) return { applied: false, reason: `invoice ${invoiceId} not found` };

  await db.logEvent({
    invoiceId,
    subAccountId: row.subAccountId,
    type: "paid",
    detail: {
      source: "stripe",
      event: event.type,
      amount_paid: toMajorUnit(amount, object?.currency),
      currency: object?.currency ?? null,
      payment_intent_id: paymentIntentId,
    },
  });

  return { applied: true, invoiceId };
}
