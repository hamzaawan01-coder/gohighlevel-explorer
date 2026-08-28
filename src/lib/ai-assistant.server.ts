import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type DraftContext = {
  channel: string;
  tone: string;
  businessInfo: string;
  extraInstructions: string;
  signature: string;
  bookingUrl: string | null;
  suggestEscalation: boolean;
  contact: { name: string; email: string | null; phone: string | null; stage: string | null } | null;
  deal: { title: string; stage: string | null; value: number | null } | null;
  messages: { direction: string; channel: string; body: string; at: string }[];
  /** FAQs and business documents uploaded by the workspace. */
  knowledge?: { title: string; content: string }[];
  /** Recent teammate feedback on past drafts, used to steer style. */
  feedback?: { rating: "up" | "down"; draft: string; note: string }[];
};

const CHANNEL_STYLE: Record<string, string> = {
  sms: "Keep it under 320 characters, no subject line, no markdown.",
  whatsapp: "Keep it under 500 characters, conversational, no markdown headings.",
  messenger: "Keep it short and chatty, like a social DM. No markdown.",
  instagram: "Keep it short and chatty, like a social DM. No markdown.",
  email: "Write a short email body (2-4 short paragraphs). No subject line.",
  note: "Write a short internal-facing suggested reply.",
};

/** Build the system + user prompt for a suggested reply. Pure, so it is testable. */
export function buildDraftPrompt(ctx: DraftContext): { system: string; prompt: string } {
  const style = CHANNEL_STYLE[ctx.channel] ?? CHANNEL_STYLE.note;
  const system = [
    "You are a customer support and sales assistant for a business, drafting replies for a human teammate to review before sending.",
    `Write in a ${ctx.tone} tone.`,
    style,
    "Never invent prices, availability, policies or promises that are not in the business information.",
    "If you do not know something, say you will check and come back, or offer to book a call.",
    ctx.bookingUrl
      ? `When scheduling would help, invite them to book a time here: ${ctx.bookingUrl}`
      : "Do not share any booking link.",
    ctx.signature ? `End the message with this sign-off: ${ctx.signature}` : "",
    ctx.suggestEscalation
      ? "Set escalate to true when the customer asks for a human, is upset, raises a complaint, legal/refund/billing dispute, or asks something the business information cannot answer."
      : "Always set escalate to false.",
    ctx.extraInstructions ? `Additional instructions: ${ctx.extraInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const lines: string[] = [];
  lines.push("BUSINESS INFORMATION:");
  lines.push(ctx.businessInfo.trim() || "(none provided)");
  if (ctx.contact) {
    lines.push("", "CUSTOMER:");
    lines.push(
      [
        `Name: ${ctx.contact.name}`,
        ctx.contact.email ? `Email: ${ctx.contact.email}` : "",
        ctx.contact.phone ? `Phone: ${ctx.contact.phone}` : "",
        ctx.contact.stage ? `Lifecycle stage: ${ctx.contact.stage}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (ctx.deal) {
    lines.push("", "OPPORTUNITY:");
    lines.push(
      [
        `Title: ${ctx.deal.title}`,
        ctx.deal.stage ? `Stage: ${ctx.deal.stage}` : "",
        ctx.deal.value != null ? `Value: ${ctx.deal.value}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  lines.push("", `CONVERSATION (channel: ${ctx.channel}, oldest first):`);
  if (ctx.messages.length === 0) {
    lines.push("(no messages yet — write a helpful opening message)");
  } else {
    for (const m of ctx.messages) {
      lines.push(`${m.direction === "inbound" ? "Customer" : "Us"} (${m.channel}): ${m.body}`);
    }
  }
  lines.push("", "Draft the next reply from us to the customer.");
  return { system, prompt: lines.join("\n") };
}

const draftSchema = z.object({
  draft: z.string(),
  escalate: z.boolean(),
  escalation_reason: z.string(),
});

export type DraftResult = {
  draft: string;
  escalate: boolean;
  escalation_reason: string;
};

/** Ask Lovable AI for a suggested reply. Throws with a readable message on failure. */
export async function generateReplyDraft(ctx: DraftContext): Promise<DraftResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project yet.");
  const gateway = createLovableAiGatewayProvider(key);
  const { system, prompt } = buildDraftPrompt(ctx);

  try {
    const { output } = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system,
      prompt,
      output: Output.object({ schema: draftSchema }),
    });
    return {
      draft: output.draft.trim(),
      escalate: Boolean(output.escalate),
      escalation_reason: output.escalation_reason ?? "",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/402/.test(message)) {
      throw new Error(
        "AI credits are exhausted for this workspace. Add credits in Lovable to keep drafting replies.",
      );
    }
    if (/429/.test(message)) {
      throw new Error("AI is rate limited right now — try again in a few seconds.");
    }
    throw new Error(`Could not draft a reply: ${message}`);
  }
}
