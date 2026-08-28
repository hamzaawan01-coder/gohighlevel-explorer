import { generateText } from "ai";
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

  const knowledge = (ctx.knowledge ?? []).filter((k) => k.content.trim());
  if (knowledge.length > 0) {
    lines.push("", "KNOWLEDGE BASE (FAQs and business documents — treat as authoritative):");
    for (const k of knowledge) {
      lines.push(`--- ${k.title} ---`);
      lines.push(k.content.trim().slice(0, 6000));
    }
  }

  const feedback = (ctx.feedback ?? []).filter((f) => f.draft.trim() || f.note.trim());
  if (feedback.length > 0) {
    lines.push("", "TEAM FEEDBACK ON PAST DRAFTS (learn from this):");
    for (const f of feedback) {
      const verdict = f.rating === "up" ? "LIKED" : "REJECTED";
      lines.push(
        `${verdict}${f.note.trim() ? ` (reason: ${f.note.trim()})` : ""}: ${f.draft.trim().slice(0, 500)}`,
      );
    }
    lines.push(
      "Imitate the liked drafts. Avoid the phrasing, length and mistakes of the rejected drafts.",
    );
  }

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

export type DraftResult = {
  draft: string;
  escalate: boolean;
  escalation_reason: string;
};

/** Pull a draft out of the model's answer, whether it returned JSON or plain text. */
export function parseDraftResponse(text: string): DraftResult {
  const raw = text.trim();
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
      const draft = typeof obj["draft"] === "string" ? (obj["draft"] as string).trim() : "";
      if (draft) {
        return {
          draft,
          escalate: obj["escalate"] === true || obj["escalate"] === "true",
          escalation_reason:
            typeof obj["escalation_reason"] === "string" ? (obj["escalation_reason"] as string) : "",
        };
      }
    } catch {
      // fall through to plain text
    }
  }
  return { draft: fenced || raw, escalate: false, escalation_reason: "" };
}

/** Ask Lovable AI for a suggested reply. Throws with a readable message on failure. */
export async function generateReplyDraft(ctx: DraftContext): Promise<DraftResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project yet.");
  const gateway = createLovableAiGatewayProvider(key);
  const { system, prompt } = buildDraftPrompt(ctx);

  try {
    const { text } = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system: `${system}\n\nReply with ONLY a JSON object, no code fences, shaped exactly: {"draft": "the reply text", "escalate": true|false, "escalation_reason": "short reason or empty string"}.`,
      prompt,
    });
    const result = parseDraftResponse(text ?? "");
    if (!result.draft) throw new Error("the assistant returned an empty reply");
    return result;
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
