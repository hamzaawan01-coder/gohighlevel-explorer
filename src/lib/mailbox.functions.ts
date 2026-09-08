/**
 * Mailbox server functions. Each one runs as the signed-in CRM user and only
 * ever touches that user's own linked mail account.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  MailFolder,
  MailListItem,
  MailMessage,
  MailProvider,
  MailboxAccount,
} from "@/lib/mailbox";

function providerOf(value: unknown): MailProvider {
  if (value === "outlook") return "outlook";
  if (value === "forwarding") return "forwarding";
  return "gmail";
}

/** Public base URL of this app, used for the forwarding delivery address. */
function appOrigin() {
  const request = getRequest();
  if (!request) return "https://leadsconvert.co.uk";
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  if (url.hostname === "localhost" && forwarded) return `https://${forwarded}`;
  return url.origin;
}

function inboundUrlFor(token: string) {
  return `${appOrigin()}/api/public/email/inbound/${token}`;
}

/**
 * Once an inbound mail service delivers to a receiving subdomain, each mailbox
 * gets a normal-looking address to forward to instead of a long URL.
 */
function inboundAddressFor(token: string) {
  const domain = process.env["INBOUND_MAIL_DOMAIN"];
  return domain ? `${token}@${domain}` : null;
}

/** Which providers the workspace owner has set up, and what this user linked. */
export const getMailboxAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailboxAccount[]> => {
    const { listConnectionsForUser } = await import("@/lib/app-user-connector.server");
    const { getForwardedMailbox } = await import("@/lib/mailbox-forwarding.server");
    const rows = await listConnectionsForUser(context.userId);
    const forwarded = await getForwardedMailbox(context.userId);
    const find = (connector: string) => rows.find((r) => r.connector_id === connector);
    return [
      {
        provider: "gmail",
        available: !!process.env["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"],
        connected: !!find("google_mail"),
        email: find("google_mail")?.account_email ?? null,
      },
      {
        provider: "outlook",
        available: !!process.env["MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY"],
        connected: !!find("microsoft_outlook"),
        email: find("microsoft_outlook")?.account_email ?? null,
      },
      {
        provider: "forwarding",
        available: true,
        connected: !!forwarded,
        email: forwarded?.address ?? null,
        inboundUrl: forwarded ? inboundUrlFor(forwarded.inbound_token) : null,
        lastReceivedAt: forwarded?.last_received_at ?? null,
      },
    ];
  });

/** Step 1 of linking: hand the browser a provider sign-in URL. */
export const startMailboxConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: MailProvider }) => data)
  .handler(async ({ data, context }): Promise<{ authorizationUrl: string }> => {
    const provider = providerOf(data.provider);
    const {
      authorizeAppUserOAuth,
      getConnectionKeyForUser,
    } = await import("@/lib/app-user-connector.server");
    const { connectorFor, GOOGLE_SCOPES, MICROSOFT_SCOPES } = await import("@/lib/mailbox.server");

    const request = getRequest();
    if (!request) throw new Error("Mailbox sign-in must start from the app.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    const returnUrl = new URL(`/oauth/mailbox/return`, origin).toString();

    const connectorId = connectorFor(provider);
    const existing = await getConnectionKeyForUser(context.userId, connectorId);

    const credentialsConfiguration =
      provider === "gmail"
        ? { scopes: GOOGLE_SCOPES }
        : {
            scopes: MICROSOFT_SCOPES,
            domain_hint: "none",
            prompt: "select_account",
          };

    const { authorizationUrl } = await authorizeAppUserOAuth({
      connectorId,
      appUserId: context.userId,
      returnUrl,
      credentialsConfiguration,
      connectionAPIKey: existing ?? undefined,
    });
    return { authorizationUrl };
  });

/** Step 2: swap the one-time code for this user's stored mailbox link. */
export const completeMailboxConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true; email: string | null }> => {
    const {
      exchangeAppUserOAuthCode,
      saveConnectionKeyForUser,
    } = await import("@/lib/app-user-connector.server");
    const { fetchAccountEmail } = await import("@/lib/mailbox.server");

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(data.code);
    if (connectorId !== "google_mail" && connectorId !== "microsoft_outlook") {
      throw new Error("That sign-in was not for a mail account.");
    }
    const provider: MailProvider = connectorId === "google_mail" ? "gmail" : "outlook";
    let email: string | null = null;
    try {
      email = await fetchAccountEmail(provider, connectionAPIKey);
    } catch {
      /* address lookup is a nicety, not a reason to fail the link */
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey, email);
    return { ok: true, email };
  });

export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: MailProvider }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const provider = providerOf(data.provider);
    const {
      getConnectionKeyForUser,
      deleteConnectionForUser,
      disconnectAppUser,
    } = await import("@/lib/app-user-connector.server");
    const { connectorFor } = await import("@/lib/mailbox.server");
    const connectorId = connectorFor(provider);
    const key = await getConnectionKeyForUser(context.userId, connectorId);
    if (key) {
      try {
        await disconnectAppUser({ connectorId, connectionAPIKey: key });
      } catch {
        /* already gone at the provider — still forget it locally */
      }
    }
    await deleteConnectionForUser(context.userId, connectorId);
    return { ok: true };
  });

async function optionalKeyFor(userId: string, provider: MailProvider) {
  const { getConnectionKeyForUser } = await import("@/lib/app-user-connector.server");
  const { connectorFor } = await import("@/lib/mailbox.server");
  return getConnectionKeyForUser(userId, connectorFor(provider));
}

async function keyFor(userId: string, provider: MailProvider) {
  const key = await optionalKeyFor(userId, provider);
  if (!key) throw new Error("Connect your email account first.");
  return key;
}

/** The signed-in user's forwarding mailbox, or an error when they have none. */
async function forwardingMailboxFor(userId: string) {
  const { getForwardedMailbox } = await import("@/lib/mailbox-forwarding.server");
  const mailbox = await getForwardedMailbox(userId);
  if (!mailbox) throw new Error("Add your forwarding address first.");
  return mailbox;
}

export const listMailFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: MailProvider }) => data)
  .handler(async ({ data, context }): Promise<MailFolder[]> => {
    const provider = providerOf(data.provider);
    if (provider === "forwarding") {
      const { getForwardedMailbox, forwardedFolders } = await import(
        "@/lib/mailbox-forwarding.server"
      );
      const mailbox = await getForwardedMailbox(context.userId);
      if (!mailbox) return [];
      return forwardedFolders(mailbox);
    }
    const key = await optionalKeyFor(context.userId, provider);
    if (!key) return [];
    const { fetchFolders } = await import("@/lib/mailbox.server");
    return fetchFolders(provider, key);
  });


export const listMailMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      provider: MailProvider;
      folderId?: string | null;
      search?: string | null;
      pageToken?: string | null;
    }) => data,
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ items: MailListItem[]; nextPageToken: string | null }> => {
      const provider = providerOf(data.provider);
      const opts = {
        folderId: data.folderId ?? null,
        search: data.search ?? null,
        pageToken: data.pageToken ?? null,
      };
      if (provider === "forwarding") {
        const { getForwardedMailbox, forwardedMessages } = await import(
          "@/lib/mailbox-forwarding.server"
        );
        const mailbox = await getForwardedMailbox(context.userId);
        if (!mailbox) return { items: [], nextPageToken: null };
        return forwardedMessages(mailbox, opts);
      }
      const key = await optionalKeyFor(context.userId, provider);
      if (!key) return { items: [], nextPageToken: null };
      const { fetchMessages } = await import("@/lib/mailbox.server");

      return fetchMessages(provider, key, opts);
    },
  );

export const getMailMessage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: MailProvider; id: string }) => data)
  .handler(async ({ data, context }): Promise<MailMessage> => {
    const provider = providerOf(data.provider);
    if (provider === "forwarding") {
      const { forwardedMessage } = await import("@/lib/mailbox-forwarding.server");
      return forwardedMessage(await forwardingMailboxFor(context.userId), data.id);
    }
    const key = await keyFor(context.userId, provider);
    const { fetchMessage } = await import("@/lib/mailbox.server");
    return fetchMessage(provider, key, data.id);
  });

export const downloadMailAttachment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { provider: MailProvider; messageId: string; attachmentId: string }) => data,
  )
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const provider = providerOf(data.provider);
    if (provider === "forwarding") {
      throw new Error("Attachments on forwarded email can only be opened in the original mailbox.");
    }
    const key = await keyFor(context.userId, provider);
    const { fetchAttachment } = await import("@/lib/mailbox.server");
    return fetchAttachment(provider, key, data.messageId, data.attachmentId);
  });

export const sendMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      provider: MailProvider;
      to: string;
      cc?: string | null;
      subject: string;
      body: string;
      threadId?: string | null;
      inReplyToMessageId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const provider = providerOf(data.provider);
    if (!data.to.trim()) throw new Error("Add at least one recipient.");
    if (provider === "forwarding") {
      const { sendForwardedMail } = await import("@/lib/mailbox-forwarding.server");
      await sendForwardedMail(await forwardingMailboxFor(context.userId), {
        to: data.to,
        cc: data.cc ?? null,
        subject: data.subject,
        body: data.body,
        inReplyToMessageId: data.inReplyToMessageId ?? null,
      });
      return { ok: true };
    }
    const key = await keyFor(context.userId, provider);
    const { sendMail } = await import("@/lib/mailbox.server");
    await sendMail(provider, key, {
      to: data.to,
      cc: data.cc ?? null,
      subject: data.subject,
      body: data.body,
      threadId: data.threadId ?? null,
      inReplyToMessageId: data.inReplyToMessageId ?? null,
    });
    return { ok: true };
  });

export const actOnMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      provider: MailProvider;
      id: string;
      action: "read" | "unread" | "star" | "unstar" | "archive" | "trash";
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const provider = providerOf(data.provider);
    if (provider === "forwarding") {
      const { forwardedAction } = await import("@/lib/mailbox-forwarding.server");
      await forwardedAction(await forwardingMailboxFor(context.userId), data.id, data.action);
      return { ok: true };
    }
    const key = await keyFor(context.userId, provider);
    const { applyMailAction } = await import("@/lib/mailbox.server");
    await applyMailAction(provider, key, data.id, data.action);
    return { ok: true };
  });

/** Save (or change) the address this user forwards into the CRM. */
export const saveForwardingMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { address: string; displayName?: string | null }) => data)
  .handler(
    async ({ data, context }): Promise<{ ok: true; address: string; inboundUrl: string }> => {
      const { upsertForwardedMailbox } = await import("@/lib/mailbox-forwarding.server");
      const mailbox = await upsertForwardedMailbox({
        userId: context.userId,
        address: data.address,
        displayName: data.displayName ?? null,
      });
      return {
        ok: true,
        address: mailbox.address,
        inboundUrl: inboundUrlFor(mailbox.inbound_token),
      };
    },
  );

export const removeForwardingMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { deleteForwardedMailbox } = await import("@/lib/mailbox-forwarding.server");
    await deleteForwardedMailbox(context.userId);
    return { ok: true };
  });
