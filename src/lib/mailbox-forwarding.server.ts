/**
 * Server-only adapter for "forwarded" mailboxes — any email host (Hostinger,
 * cPanel, Zoho, Fastmail...) that cannot be signed into with OAuth.
 *
 * Mail arrives through the public inbound webhook and is stored in
 * forwarded_messages. Replies go out through the managed email service with
 * Reply-To set to the mailbox address, so the whole conversation stays with
 * the customer's own address.
 */
import type { MailFolder, MailListItem, MailMessage } from "@/lib/mailbox";

export type ForwardedMailbox = {
  id: string;
  user_id: string;
  address: string;
  display_name: string | null;
  inbound_token: string;
  active: boolean;
  last_received_at: string | null;
};

type Row = {
  id: string;
  direction: string;
  folder: string;
  from_address: string;
  from_name: string;
  to_address: string;
  cc_address: string;
  subject: string;
  snippet: string;
  body_text: string | null;
  body_html: string | null;
  attachments: unknown;
  unread: boolean;
  starred: boolean;
  thread_key: string;
  provider_message_id: string | null;
  received_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

/** "Name <a@b.com>" -> parts. */
export function splitAddress(raw: string) {
  const match = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(raw ?? "");
  if (match) return { name: (match[1] ?? "").trim(), address: (match[2] ?? "").trim() };
  return { name: "", address: (raw ?? "").trim() };
}

export function threadKeyFor(subject: string) {
  return (subject ?? "")
    .replace(/^\s*((re|fwd|fw|aw|sv)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase()
    .slice(0, 180);
}

export function snippetFrom(text: string | null, html: string | null) {
  const source = text?.trim() || stripHtml(html ?? "");
  return source.replace(/\s+/g, " ").slice(0, 200);
}

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function getForwardedMailbox(userId: string): Promise<ForwardedMailbox | null> {
  const db = await admin();
  const { data, error } = await db
    .from("forwarded_mailboxes")
    .select("id,user_id,address,display_name,inbound_token,active,last_received_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ForwardedMailbox | null) ?? null;
}

export async function getMailboxByToken(token: string): Promise<ForwardedMailbox | null> {
  const db = await admin();
  const { data, error } = await db
    .from("forwarded_mailboxes")
    .select("id,user_id,address,display_name,inbound_token,active,last_received_at")
    .eq("inbound_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ForwardedMailbox | null) ?? null;
}

export async function upsertForwardedMailbox(input: {
  userId: string;
  address: string;
  displayName?: string | null;
}): Promise<ForwardedMailbox> {
  const address = normalizeAddress(input.address);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error("Enter a valid email address, for example you@yourdomain.com.");
  }
  const db = await admin();
  const existing = await getForwardedMailbox(input.userId);
  if (existing) {
    const { data, error } = await db
      .from("forwarded_mailboxes")
      .update({
        address,
        display_name: input.displayName ?? existing.display_name,
        active: true,
      })
      .eq("id", existing.id)
      .select("id,user_id,address,display_name,inbound_token,active,last_received_at")
      .single();
    if (error) throw new Error(error.message);
    return data as ForwardedMailbox;
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await db
    .from("forwarded_mailboxes")
    .insert({
      user_id: input.userId,
      address,
      display_name: input.displayName ?? null,
      inbound_token: token,
    })
    .select("id,user_id,address,display_name,inbound_token,active,last_received_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ForwardedMailbox;
}

export async function deleteForwardedMailbox(userId: string) {
  const db = await admin();
  const { error } = await db.from("forwarded_mailboxes").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

const FOLDERS: { id: string; name: string }[] = [
  { id: "inbox", name: "Inbox" },
  { id: "starred", name: "Starred" },
  { id: "sent", name: "Sent" },
  { id: "archive", name: "Archive" },
  { id: "trash", name: "Trash" },
];

export async function forwardedFolders(mailbox: ForwardedMailbox): Promise<MailFolder[]> {
  const db = await admin();
  const { count } = await db
    .from("forwarded_messages")
    .select("id", { count: "exact", head: true })
    .eq("mailbox_id", mailbox.id)
    .eq("folder", "inbox")
    .eq("unread", true);
  return FOLDERS.map((f) => ({
    id: f.id,
    name: f.name,
    unread: f.id === "inbox" ? (count ?? 0) || null : null,
    system: true,
  }));
}

function toListItem(row: Row): MailListItem {
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  return {
    id: row.id,
    threadId: row.thread_key || null,
    from: row.from_address,
    fromName: row.from_name,
    to: row.to_address,
    subject: row.subject,
    snippet: row.snippet,
    date: row.received_at,
    unread: row.unread,
    starred: row.starred,
    hasAttachments: attachments.length > 0,
  };
}

export async function forwardedMessages(
  mailbox: ForwardedMailbox,
  opts: { folderId?: string | null; search?: string | null; pageToken?: string | null },
): Promise<{ items: MailListItem[]; nextPageToken: string | null }> {
  const db = await admin();
  const page = Number(opts.pageToken ?? 0) || 0;
  const size = 25;
  let query = db
    .from("forwarded_messages")
    .select(
      "id,direction,folder,from_address,from_name,to_address,cc_address,subject,snippet,body_text,body_html,attachments,unread,starred,thread_key,provider_message_id,received_at",
    )
    .eq("mailbox_id", mailbox.id)
    .order("received_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  const folder = opts.folderId ?? "inbox";
  if (folder === "starred") query = query.eq("starred", true).neq("folder", "trash");
  else query = query.eq("folder", folder);

  const search = opts.search?.trim();
  if (search) {
    const safe = search.replace(/[%,]/g, " ");
    query = query.or(
      `subject.ilike.%${safe}%,from_address.ilike.%${safe}%,from_name.ilike.%${safe}%,snippet.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  return {
    items: rows.map(toListItem),
    nextPageToken: rows.length === size ? String(page + 1) : null,
  };
}

export async function forwardedMessage(
  mailbox: ForwardedMailbox,
  id: string,
): Promise<MailMessage> {
  const db = await admin();
  const { data, error } = await db
    .from("forwarded_messages")
    .select(
      "id,direction,folder,from_address,from_name,to_address,cc_address,subject,snippet,body_text,body_html,attachments,unread,starred,thread_key,provider_message_id,received_at",
    )
    .eq("mailbox_id", mailbox.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That email is no longer available.");
  const row = data as Row;
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  return {
    ...toListItem(row),
    cc: row.cc_address,
    html: row.body_html,
    text: row.body_text,
    attachments: attachments.map((a, index) => {
      const item = (a ?? {}) as { filename?: string; mimeType?: string; size?: number };
      return {
        id: `${row.id}:${index}`,
        filename: item.filename ?? `attachment-${index + 1}`,
        mimeType: item.mimeType ?? "application/octet-stream",
        size: Number(item.size ?? 0),
      };
    }),
  };
}

export async function forwardedAction(
  mailbox: ForwardedMailbox,
  id: string,
  action: "read" | "unread" | "star" | "unstar" | "archive" | "trash",
) {
  const db = await admin();
  const patch: { unread?: boolean; starred?: boolean; folder?: string } =
    action === "read"
      ? { unread: false }
      : action === "unread"
        ? { unread: true }
        : action === "star"
          ? { starred: true }
          : action === "unstar"
            ? { starred: false }
            : action === "archive"
              ? { folder: "archive" }
              : { folder: "trash" };
  const { error } = await db
    .from("forwarded_messages")
    .update(patch)
    .eq("mailbox_id", mailbox.id)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Store an inbound email that arrived through the forwarding webhook. */
export async function storeInboundMail(
  mailbox: ForwardedMailbox,
  mail: {
    from: string;
    to: string;
    cc?: string | null;
    subject: string;
    text?: string | null;
    html?: string | null;
    messageId?: string | null;
    inReplyTo?: string | null;
    receivedAt?: string | null;
    attachments?: { filename: string; mimeType: string; size: number }[];
  },
) {
  const db = await admin();
  const from = splitAddress(mail.from);
  const text = mail.text ?? null;
  const html = mail.html ?? null;

  // Prefer real threading headers over the subject line: a reply whose subject
  // was edited still belongs to the same conversation.
  let threadKey = threadKeyFor(mail.subject);
  if (mail.inReplyTo) {
    const { data: parent } = await db
      .from("forwarded_messages")
      .select("thread_key")
      .eq("mailbox_id", mailbox.id)
      .eq("provider_message_id", mail.inReplyTo)
      .maybeSingle();
    const parentKey = (parent as { thread_key?: string } | null)?.thread_key;
    if (parentKey) threadKey = parentKey;
  }
  const { error } = await db.from("forwarded_messages").upsert(
    {
      mailbox_id: mailbox.id,
      user_id: mailbox.user_id,
      direction: "inbound",
      folder: "inbox",
      from_address: from.address || mail.from,
      from_name: from.name,
      to_address: mail.to || mailbox.address,
      cc_address: mail.cc ?? "",
      subject: mail.subject || "(no subject)",
      snippet: snippetFrom(text, html),
      body_text: text,
      body_html: html,
      attachments: mail.attachments ?? [],
      unread: true,
      thread_key: threadKey,
      provider_message_id: mail.messageId ?? null,
      in_reply_to: mail.inReplyTo ?? null,
      received_at: mail.receivedAt ?? new Date().toISOString(),
    },
    { onConflict: "mailbox_id,provider_message_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  await db
    .from("forwarded_mailboxes")
    .update({ last_received_at: new Date().toISOString() })
    .eq("id", mailbox.id);
}

/**
 * Send a reply. The managed email service only signs the CRM's own verified
 * domain, so the customer's address travels as the display name and Reply-To —
 * every reply the recipient sends comes straight back to their mailbox.
 */
export async function sendForwardedMail(
  mailbox: ForwardedMailbox,
  input: {
    to: string;
    cc?: string | null;
    subject: string;
    body: string;
    inReplyToMessageId?: string | null;
  },
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Email sending is not configured yet.");
  const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");

  const label = mailbox.display_name?.trim() || mailbox.address;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(
    input.body,
  )}</div>`;

  try {
    await sendLovableEmail(
      {
        to: input.to,
        cc: input.cc ? input.cc : undefined,
        from: `${label} <noreply@leadsconvert.co.uk>`,
        sender_domain: "notify.leadsconvert.co.uk",
        subject: input.subject || "(no subject)",
        html,
        text: input.body,
        purpose: "transactional",
        label: "forwarded-mailbox-reply",
        idempotency_key: crypto.randomUUID(),
        reply_to: mailbox.address,
      } as Parameters<typeof sendLovableEmail>[0],
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      throw new Error("That recipient has unsubscribed or previously bounced.");
    }
    throw error;
  }

  const db = await admin();
  await db.from("forwarded_messages").insert({
    mailbox_id: mailbox.id,
    user_id: mailbox.user_id,
    direction: "outbound",
    folder: "sent",
    from_address: mailbox.address,
    from_name: label,
    to_address: input.to,
    cc_address: input.cc ?? "",
    subject: input.subject,
    snippet: snippetFrom(input.body, null),
    body_text: input.body,
    body_html: html,
    unread: false,
    thread_key: threadKeyFor(input.subject),
    in_reply_to: input.inReplyToMessageId ?? null,
    received_at: new Date().toISOString(),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
