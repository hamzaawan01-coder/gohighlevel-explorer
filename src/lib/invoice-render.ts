/**
 * Pure rendering helpers shared by the invoice email, the reminder email and
 * the branded print/PDF view. No Supabase or browser APIs here so the same
 * output can be produced on the server (email) and in the browser (print).
 */
import { formatMoney, type Invoice, type InvoiceItem } from "./invoices";

export type InvoiceBranding = {
  sub_account_id: string;
  business_name: string | null;
  logo_url: string | null;
  accent_color: string;
  address: string | null;
  payment_instructions: string | null;
  terms: string | null;
  footer_note: string | null;
};

export const DEFAULT_BRANDING: Omit<InvoiceBranding, "sub_account_id"> = {
  business_name: null,
  logo_url: null,
  accent_color: "#4f46e5",
  address: null,
  payment_instructions: null,
  terms: null,
  footer_note: null,
};

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only allow simple hex colours into the generated markup. */
export function safeColor(value: string | null | undefined): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : DEFAULT_BRANDING.accent_color;
}

export type RenderContext = {
  invoice: Invoice;
  items: InvoiceItem[];
  branding: Partial<InvoiceBranding> | null;
  recipientName?: string | null;
  payUrl?: string | null;
  /** Reminder sequence — when set the copy switches to a follow-up tone. */
  reminderSequence?: number | null;
};

function lineRows(ctx: RenderContext): string {
  const accent = safeColor(ctx.branding?.accent_color);
  if (!ctx.items.length) {
    return `<tr><td colspan="4" style="padding:10px;color:#64748b">No line items</td></tr>`;
  }
  return ctx.items
    .map((it) => {
      const amount = formatMoney(Number(it.quantity) * Number(it.unit_price), ctx.invoice.currency);
      return `<tr>
  <td style="padding:10px;border-top:1px solid #e2e8f0">${esc(it.description || "—")}</td>
  <td style="padding:10px;border-top:1px solid #e2e8f0;text-align:right">${esc(it.quantity)}</td>
  <td style="padding:10px;border-top:1px solid #e2e8f0;text-align:right">${esc(
    formatMoney(Number(it.unit_price), ctx.invoice.currency),
  )}</td>
  <td style="padding:10px;border-top:1px solid #e2e8f0;text-align:right;color:${accent}">${esc(amount)}</td>
</tr>`;
    })
    .join("\n");
}

export function renderInvoiceHtml(ctx: RenderContext): string {
  const { invoice } = ctx;
  const accent = safeColor(ctx.branding?.accent_color);
  const business = ctx.branding?.business_name || "Invoice";
  const logo = ctx.branding?.logo_url
    ? `<img src="${esc(ctx.branding.logo_url)}" alt="${esc(business)}" style="max-height:56px" />`
    : `<div style="font-size:20px;font-weight:700;color:${accent}">${esc(business)}</div>`;

  const intro = ctx.reminderSequence
    ? `<p style="margin:0 0 16px">This is reminder ${ctx.reminderSequence} for invoice <strong>${esc(
        invoice.number,
      )}</strong>, which is now past its due date${
        invoice.due_date ? ` (${esc(invoice.due_date)})` : ""
      }.</p>`
    : `<p style="margin:0 0 16px">Please find invoice <strong>${esc(invoice.number)}</strong> below.</p>`;

  const payButton = ctx.payUrl
    ? `<p style="margin:24px 0"><a href="${esc(ctx.payUrl)}" style="background:${accent};color:#fff;
       padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Pay this invoice</a></p>`
    : "";

  const block = (title: string, body: string | null | undefined) =>
    body
      ? `<div style="margin-top:20px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;
         color:#64748b">${esc(title)}</div><div style="white-space:pre-wrap;color:#334155">${esc(body)}</div></div>`
      : "";

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:24px">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
    <div style="border-top:4px solid ${accent};padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div>${logo}${
          ctx.branding?.address
            ? `<div style="color:#64748b;font-size:12px;white-space:pre-wrap;margin-top:6px">${esc(
                ctx.branding.address,
              )}</div>`
            : ""
        }</div>
        <div style="text-align:right">
          <div style="font-size:12px;color:#64748b">Invoice</div>
          <div style="font-weight:700">${esc(invoice.number)}</div>
          <div style="font-size:12px;color:#64748b">Issued ${esc(invoice.issue_date)}</div>
          ${invoice.due_date ? `<div style="font-size:12px;color:#64748b">Due ${esc(invoice.due_date)}</div>` : ""}
        </div>
      </div>

      <p style="margin:24px 0 0">Hi ${esc(ctx.recipientName || "there")},</p>
      ${intro}

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#64748b;font-size:12px">
          <th style="padding:8px 10px">Description</th>
          <th style="padding:8px 10px;text-align:right">Qty</th>
          <th style="padding:8px 10px;text-align:right">Unit</th>
          <th style="padding:8px 10px;text-align:right">Amount</th>
        </tr></thead>
        <tbody>${lineRows(ctx)}</tbody>
      </table>

      <table style="width:100%;margin-top:16px;font-size:14px">
        <tr><td style="color:#64748b">Subtotal</td><td style="text-align:right">${esc(
          formatMoney(invoice.subtotal, invoice.currency),
        )}</td></tr>
        <tr><td style="color:#64748b">Tax (${esc(invoice.tax_rate)}%)</td><td style="text-align:right">${esc(
          formatMoney(invoice.tax_amount, invoice.currency),
        )}</td></tr>
        <tr><td style="font-weight:700;padding-top:6px">Total</td>
            <td style="text-align:right;font-weight:700;color:${accent};padding-top:6px">${esc(
              formatMoney(invoice.total, invoice.currency),
            )}</td></tr>
      </table>

      ${payButton}
      ${block("Payment instructions", ctx.branding?.payment_instructions)}
      ${block("Notes", invoice.notes)}
      ${block("Terms", ctx.branding?.terms)}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;color:#64748b;font-size:12px;
    white-space:pre-wrap">${esc(ctx.branding?.footer_note || "Thank you for your business.")}</div>
  </div>
</div></body></html>`;
}

export function renderInvoiceText(ctx: RenderContext): string {
  const { invoice } = ctx;
  const lines = [
    ctx.reminderSequence
      ? `Reminder ${ctx.reminderSequence}: invoice ${invoice.number} is overdue.`
      : `Invoice ${invoice.number}`,
    ctx.branding?.business_name ? `From: ${ctx.branding.business_name}` : null,
    `Issued: ${invoice.issue_date}`,
    invoice.due_date ? `Due: ${invoice.due_date}` : null,
    "",
    ...ctx.items.map(
      (i) =>
        `- ${i.description || "item"} x${i.quantity} @ ${formatMoney(
          Number(i.unit_price),
          invoice.currency,
        )} = ${formatMoney(Number(i.quantity) * Number(i.unit_price), invoice.currency)}`,
    ),
    "",
    `Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`,
    `Tax (${invoice.tax_rate}%): ${formatMoney(invoice.tax_amount, invoice.currency)}`,
    `Total: ${formatMoney(invoice.total, invoice.currency)}`,
    ctx.payUrl ? `\nPay online: ${ctx.payUrl}` : null,
    ctx.branding?.payment_instructions ? `\n${ctx.branding.payment_instructions}` : null,
    invoice.notes ? `\nNotes: ${invoice.notes}` : null,
    ctx.branding?.terms ? `\nTerms: ${ctx.branding.terms}` : null,
    ctx.branding?.footer_note ? `\n${ctx.branding.footer_note}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function invoiceEmailSubject(ctx: RenderContext): string {
  const who = ctx.branding?.business_name ? ` from ${ctx.branding.business_name}` : "";
  return ctx.reminderSequence
    ? `Reminder: invoice ${ctx.invoice.number} is overdue`
    : `Invoice ${ctx.invoice.number}${who}`;
}

export function renderInvoiceEmail(ctx: RenderContext) {
  return {
    subject: invoiceEmailSubject(ctx),
    html: renderInvoiceHtml(ctx),
    text: renderInvoiceText(ctx),
  };
}
