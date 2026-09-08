/**
 * Server-only mail provider adapters.
 *
 * Every call goes through the Lovable connector gateway using the signed-in
 * user's own per-user connection, so one CRM user can never read another's
 * mail. Gmail speaks the Gmail REST API; Outlook speaks Microsoft Graph.
 */
import {
  callAsAppUser,
  type MailConnectorId,
} from "@/lib/app-user-connector.server";
import type {
  MailAttachment,
  MailFolder,
  MailListItem,
  MailMessage,
  MailProvider,
} from "@/lib/mailbox";

export function connectorFor(provider: MailProvider): MailConnectorId {
  return provider === "gmail" ? "google_mail" : "microsoft_outlook";
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Mail.ReadWrite",
  "Mail.Send",
];

async function call(
  provider: MailProvider,
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
) {
  const res = await callAsAppUser({
    connectorId: connectorFor(provider),
    connectionAPIKey,
    path,
    init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mail request failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res;
}

async function json<T>(
  provider: MailProvider,
  key: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await call(provider, key, path, init);
  return (await res.json()) as T;
}

/* ----------------------------------------------------------------- helpers */

function parseAddress(raw: string) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw || "");
  if (match) return { name: match[1].replace(/^"|"$/g, ""), email: match[2] };
  return { name: "", email: (raw || "").trim() };
}

function b64urlDecode(data: string): string {
  const normalised = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalised, "base64").toString("utf8");
}

function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mimeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/* -------------------------------------------------------------------- Gmail */

type GmailHeader = { name: string; value: string };
type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
};

const GMAIL_SYSTEM: Record<string, string> = {
  INBOX: "Inbox",
  STARRED: "Starred",
  SENT: "Sent",
  DRAFT: "Drafts",
  SPAM: "Spam",
  TRASH: "Trash",
  IMPORTANT: "Important",
};
const GMAIL_ORDER = ["INBOX", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH", "IMPORTANT"];

function header(msg: GmailMessage, name: string) {
  const list = msg.payload?.headers ?? [];
  return list.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function flattenParts(part?: GmailPart, out: GmailPart[] = []): GmailPart[] {
  if (!part) return out;
  out.push(part);
  for (const child of part.parts ?? []) flattenParts(child, out);
  return out;
}

function gmailToListItem(msg: GmailMessage): MailListItem {
  const fromRaw = header(msg, "From");
  const from = parseAddress(fromRaw);
  const labels = msg.labelIds ?? [];
  const parts = flattenParts(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId ?? null,
    from: from.email,
    fromName: from.name,
    to: header(msg, "To"),
    subject: header(msg, "Subject") || "(no subject)",
    snippet: msg.snippet ?? "",
    date: msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : header(msg, "Date") || null,
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    hasAttachments: parts.some((p) => !!p.filename && !!p.body?.attachmentId),
  };
}

function gmailBody(msg: GmailMessage) {
  const parts = flattenParts(msg.payload);
  const pick = (mime: string) =>
    parts.find((p) => p.mimeType === mime && p.body?.data && !p.filename)?.body?.data;
  const html = pick("text/html");
  const text = pick("text/plain");
  const attachments: MailAttachment[] = parts
    .filter((p) => p.filename && p.body?.attachmentId)
    .map((p) => ({
      id: p.body!.attachmentId!,
      filename: p.filename!,
      mimeType: p.mimeType ?? "application/octet-stream",
      size: p.body?.size ?? 0,
    }));
  return {
    html: html ? b64urlDecode(html) : null,
    text: text ? b64urlDecode(text) : null,
    attachments,
  };
}

/* ------------------------------------------------------------------ Outlook */

type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  flag?: { flagStatus?: string };
  hasAttachments?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  ccRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  body?: { contentType?: string; content?: string };
};

function graphToListItem(msg: GraphMessage): MailListItem {
  return {
    id: msg.id,
    threadId: msg.conversationId ?? null,
    from: msg.from?.emailAddress?.address ?? "",
    fromName: msg.from?.emailAddress?.name ?? "",
    to: (msg.toRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", "),
    subject: msg.subject || "(no subject)",
    snippet: msg.bodyPreview ?? "",
    date: msg.receivedDateTime ?? null,
    unread: msg.isRead === false,
    starred: msg.flag?.flagStatus === "flagged",
    hasAttachments: !!msg.hasAttachments,
  };
}

/* ------------------------------------------------------------- public API */

export async function fetchAccountEmail(provider: MailProvider, key: string) {
  if (provider === "gmail") {
    const p = await json<{ emailAddress?: string }>(
      provider,
      key,
      "/gmail/v1/users/me/profile",
    );
    return p.emailAddress ?? null;
  }
  const me = await json<{ mail?: string; userPrincipalName?: string }>(
    provider,
    key,
    "/me?$select=mail,userPrincipalName",
  );
  return me.mail ?? me.userPrincipalName ?? null;
}

export async function fetchFolders(provider: MailProvider, key: string): Promise<MailFolder[]> {
  if (provider === "gmail") {
    const data = await json<{
      labels?: { id: string; name: string; type?: string; messagesUnread?: number }[];
    }>(provider, key, "/gmail/v1/users/me/labels");
    const labels = data.labels ?? [];
    const folders = labels
      .filter((l) => l.type !== "system" || !!GMAIL_SYSTEM[l.id])
      .map<MailFolder>((l) => ({
        id: l.id,
        name: GMAIL_SYSTEM[l.id] ?? l.name,
        unread: l.messagesUnread ?? null,
        system: !!GMAIL_SYSTEM[l.id],
      }));
    return folders.sort((a, b) => {
      const ai = GMAIL_ORDER.indexOf(a.id);
      const bi = GMAIL_ORDER.indexOf(b.id);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.name.localeCompare(b.name);
    });
  }

  const data = await json<{
    value?: { id: string; displayName: string; unreadItemCount?: number }[];
  }>(provider, key, "/me/mailFolders?$top=50");
  return (data.value ?? []).map<MailFolder>((f) => ({
    id: f.id,
    name: f.displayName,
    unread: f.unreadItemCount ?? null,
    system: ["Inbox", "Sent Items", "Drafts", "Deleted Items", "Junk Email"].includes(
      f.displayName,
    ),
  }));
}

export async function fetchMessages(
  provider: MailProvider,
  key: string,
  opts: { folderId?: string | null; search?: string | null; pageToken?: string | null },
): Promise<{ items: MailListItem[]; nextPageToken: string | null }> {
  if (provider === "gmail") {
    const params = new URLSearchParams({ maxResults: "25" });
    if (opts.folderId) params.set("labelIds", opts.folderId);
    if (opts.search) params.set("q", opts.search);
    if (opts.pageToken) params.set("pageToken", opts.pageToken);
    const list = await json<{
      messages?: { id: string }[];
      nextPageToken?: string;
    }>(provider, key, `/gmail/v1/users/me/messages?${params}`);
    const ids = (list.messages ?? []).map((m) => m.id);
    const items = await gmailBatchMetadata(key, ids);
    return { items, nextPageToken: list.nextPageToken ?? null };
  }

  const params = new URLSearchParams({
    $top: "25",
    $select: "id,conversationId,subject,bodyPreview,receivedDateTime,isRead,flag,hasAttachments,from,toRecipients",
  });
  if (opts.search) params.set("$search", `"${opts.search.replace(/"/g, "")}"`);
  else params.set("$orderby", "receivedDateTime desc");
  if (opts.pageToken) params.set("$skip", opts.pageToken);
  const path = opts.folderId
    ? `/me/mailFolders/${encodeURIComponent(opts.folderId)}/messages?${params}`
    : `/me/messages?${params}`;
  const data = await json<{ value?: GraphMessage[] }>(provider, key, path);
  const items = (data.value ?? []).map(graphToListItem);
  const skip = Number(opts.pageToken ?? "0") + items.length;
  return {
    items,
    nextPageToken: items.length === 25 ? String(skip) : null,
  };
}

/**
 * Gmail list endpoints return ids only. One multipart batch fetches the row
 * metadata for a whole page instead of 25 separate gateway round trips.
 */
async function gmailBatchMetadata(key: string, ids: string[]): Promise<MailListItem[]> {
  if (!ids.length) return [];
  const boundary = `batch_${Math.random().toString(36).slice(2)}`;
  const headers =
    "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date";
  const body =
    ids
      .map(
        (id) =>
          `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/${id}?${headers}\r\n`,
      )
      .join("") + `--${boundary}--\r\n`;

  const res = await callAsAppUser({
    connectorId: "google_mail",
    connectionAPIKey: key,
    path: "/batch/gmail/v1",
    init: {
      method: "POST",
      headers: { "Content-Type": `multipart/mixed; boundary=${boundary}` },
      body,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mail list failed (${res.status}): ${text.slice(0, 300)}`);

  const replyBoundary = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(
    res.headers.get("content-type") ?? "",
  );
  const marker = replyBoundary?.[1] ?? replyBoundary?.[2];
  const chunks = marker ? text.split(`--${marker}`) : [text];
  const byId = new Map<string, MailListItem>();
  for (const chunk of chunks) {
    const start = chunk.indexOf("{");
    if (start === -1) continue;
    const statusLine = /HTTP\/[\d.]+\s+(\d{3})/.exec(chunk);
    if (statusLine && !statusLine[1].startsWith("2")) {
      console.error(`Gmail batch part failed: ${chunk.slice(0, 200)}`);
      continue;
    }
    try {
      const msg = JSON.parse(chunk.slice(start, chunk.lastIndexOf("}") + 1)) as GmailMessage;
      if (msg?.id) byId.set(msg.id, gmailToListItem(msg));
    } catch {
      /* not a JSON part */
    }
  }
  return ids.map((id) => byId.get(id)).filter((m): m is MailListItem => !!m);
}

export async function fetchMessage(
  provider: MailProvider,
  key: string,
  id: string,
): Promise<MailMessage> {
  if (provider === "gmail") {
    const msg = await json<GmailMessage>(
      provider,
      key,
      `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
    );
    const base = gmailToListItem(msg);
    const body = gmailBody(msg);
    return { ...base, cc: header(msg, "Cc"), ...body };
  }

  const msg = await json<GraphMessage>(
    provider,
    key,
    `/me/messages/${encodeURIComponent(id)}`,
  );
  const base = graphToListItem(msg);
  let attachments: MailAttachment[] = [];
  if (msg.hasAttachments) {
    const list = await json<{
      value?: { id: string; name?: string; contentType?: string; size?: number }[];
    }>(provider, key, `/me/messages/${encodeURIComponent(id)}/attachments`);
    attachments = (list.value ?? []).map((a) => ({
      id: a.id,
      filename: a.name ?? "attachment",
      mimeType: a.contentType ?? "application/octet-stream",
      size: a.size ?? 0,
    }));
  }
  const isHtml = (msg.body?.contentType ?? "").toLowerCase() === "html";
  return {
    ...base,
    cc: (msg.ccRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", "),
    html: isHtml ? msg.body?.content ?? null : null,
    text: isHtml ? null : msg.body?.content ?? null,
    attachments,
  };
}

/** Attachment bytes as a base64 string plus its content type. */
export async function fetchAttachment(
  provider: MailProvider,
  key: string,
  messageId: string,
  attachmentId: string,
): Promise<{ base64: string }> {
  if (provider === "gmail") {
    const data = await json<{ data?: string }>(
      provider,
      key,
      `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    const raw = (data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
    return { base64: raw };
  }
  const data = await json<{ contentBytes?: string }>(
    provider,
    key,
    `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return { base64: data.contentBytes ?? "" };
}

export type SendMailInput = {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
  /** Reply threading. */
  threadId?: string | null;
  inReplyToMessageId?: string | null;
};

export async function sendMail(provider: MailProvider, key: string, input: SendMailInput) {
  if (provider === "gmail") {
    const lines = [
      `To: ${input.to}`,
      input.cc ? `Cc: ${input.cc}` : null,
      `Subject: ${mimeHeader(input.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      input.body,
    ].filter(Boolean);
    const raw = b64urlEncode(lines.join("\r\n"));
    await call(provider, key, "/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, threadId: input.threadId ?? undefined }),
    });
    return;
  }

  const recipients = (value: string) =>
    value
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map((address) => ({ emailAddress: { address } }));

  if (input.inReplyToMessageId) {
    await call(provider, key, `/me/messages/${encodeURIComponent(input.inReplyToMessageId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: input.body }),
    });
    return;
  }

  await call(provider, key, "/me/sendMail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: recipients(input.to),
        ccRecipients: input.cc ? recipients(input.cc) : [],
      },
    }),
  });
}

export type MailAction = "read" | "unread" | "star" | "unstar" | "archive" | "trash";

export async function applyMailAction(
  provider: MailProvider,
  key: string,
  id: string,
  action: MailAction,
) {
  if (provider === "gmail") {
    if (action === "trash") {
      await call(provider, key, `/gmail/v1/users/me/messages/${encodeURIComponent(id)}/trash`, {
        method: "POST",
      });
      return;
    }
    const patch: { addLabelIds?: string[]; removeLabelIds?: string[] } =
      action === "read"
        ? { removeLabelIds: ["UNREAD"] }
        : action === "unread"
          ? { addLabelIds: ["UNREAD"] }
          : action === "star"
            ? { addLabelIds: ["STARRED"] }
            : action === "unstar"
              ? { removeLabelIds: ["STARRED"] }
              : { removeLabelIds: ["INBOX"] };
    await call(provider, key, `/gmail/v1/users/me/messages/${encodeURIComponent(id)}/modify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return;
  }

  const path = `/me/messages/${encodeURIComponent(id)}`;
  if (action === "trash") {
    await call(provider, key, `${path}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId: "deleteditems" }),
    });
    return;
  }
  if (action === "archive") {
    await call(provider, key, `${path}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId: "archive" }),
    });
    return;
  }
  const patch =
    action === "read"
      ? { isRead: true }
      : action === "unread"
        ? { isRead: false }
        : action === "star"
          ? { flag: { flagStatus: "flagged" } }
          : { flag: { flagStatus: "notFlagged" } };
  await call(provider, key, path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
