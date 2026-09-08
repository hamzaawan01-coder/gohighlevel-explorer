/** Client-safe mailbox types shared between the mail page and server functions. */

export type MailProvider = "gmail" | "outlook" | "forwarding";

export type MailFolder = {
  id: string;
  name: string;
  /** Unread count when the provider reports one. */
  unread?: number | null;
  /** System folders sort first and keep friendly names. */
  system: boolean;
};

export type MailListItem = {
  id: string;
  threadId: string | null;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
};

export type MailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type MailMessage = MailListItem & {
  cc: string;
  html: string | null;
  text: string | null;
  attachments: MailAttachment[];
};

export type MailboxAccount = {
  provider: MailProvider;
  connected: boolean;
  /** False when the workspace owner has not set that provider up yet. */
  available: boolean;
  email: string | null;
  /** Forwarding mailboxes only: where the mail host should deliver copies. */
  inboundUrl?: string | null;
  lastReceivedAt?: string | null;
};

export const PROVIDER_LABEL: Record<MailProvider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  forwarding: "Other host (forwarding)",
};

/** Pretty display name from a raw "Name <a@b.com>" header. */
export function displayName(item: { fromName: string; from: string }) {
  return item.fromName || item.from || "Unknown sender";
}

export function initialsFor(value: string) {
  const clean = value.replace(/[<>"]/g, " ").trim();
  const parts = clean.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
