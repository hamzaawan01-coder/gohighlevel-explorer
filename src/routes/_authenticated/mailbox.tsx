import { createFileRoute } from "@tanstack/react-router";
import { beginOAuthHandoff } from "@/lib/oauth-handoff";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Loader2,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { useSessionReady } from "@/lib/session-ready";
import {
  PROVIDER_LABEL,
  displayName,
  initialsFor,
  type MailListItem,
  type MailProvider,
} from "@/lib/mailbox";
import {
  actOnMailMessage,
  completeMailboxConnect,
  disconnectMailbox,
  getMailMessage,
  getMailboxAccounts,
  listMailFolders,
  listMailMessages,
  sendMailMessage,
  startMailboxConnect,
} from "@/lib/mailbox.functions";

export const Route = createFileRoute("/_authenticated/mailbox")({
  head: () => ({
    meta: [
      { title: "Mailbox — Lead Convert" },
      {
        name: "description",
        content:
          "Read, search and reply to your own email inside the CRM by signing in to your Gmail or Outlook account.",
      },
      { property: "og:title", content: "Mailbox — Lead Convert" },
      {
        property: "og:description",
        content: "Your own email inbox, folders, search and replies inside Lead Convert.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailboxPage,
});

function when(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function sizeLabel(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Wait for the sign-in window to report back with the one-time code. */
function waitForCode() {
  return new Promise<string>((resolve, reject) => {
    let timer: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timer !== undefined) window.clearTimeout(timer);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type;
      if (type !== "mailboxOAuthComplete" && type !== "mailboxOAuthFailed") return;
      cleanup();
      if (type === "mailboxOAuthComplete" && typeof event.data?.code === "string") {
        resolve(event.data.code);
      } else {
        reject(new Error("Sign-in was not completed."));
      }
    };
    window.addEventListener("message", onMessage);
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Sign-in timed out. Please try again."));
    }, 5 * 60 * 1000);
  });
}


function MailboxPage() {
  const { ready } = useSessionReady();
  const qc = useQueryClient();

  const [provider, setProvider] = useState<MailProvider>("gmail");
  const [folderId, setFolderId] = useState<string | null>("INBOX");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [connecting, setConnecting] = useState<MailProvider | null>(null);

  const accountsQ = useQuery({
    queryKey: ["mailbox", "accounts"],
    queryFn: () => getMailboxAccounts(),
    enabled: ready,
  });
  const accounts = accountsQ.data ?? [];
  const active = accounts.find((a) => a.provider === provider);
  const connected = !!active?.connected;

  // Land on whichever account the user has actually linked.
  const pickedRef = useRef(false);
  useEffect(() => {
    if (pickedRef.current || !accounts.length) return;
    const linked = accounts.find((a) => a.connected);
    if (linked) setProvider(linked.provider);
    pickedRef.current = true;
  }, [accounts]);

  useEffect(() => {
    setFolderId(provider === "gmail" ? "INBOX" : null);
    setOpenId(null);
  }, [provider]);

  const foldersQ = useQuery({
    queryKey: ["mailbox", provider, "folders"],
    queryFn: () => listMailFolders({ data: { provider } }),
    enabled: ready && connected,
  });

  const listQ = useQuery({
    queryKey: ["mailbox", provider, "list", folderId, search],
    queryFn: () =>
      listMailMessages({ data: { provider, folderId, search: search || null } }),
    enabled: ready && connected,
  });

  const messageQ = useQuery({
    queryKey: ["mailbox", provider, "message", openId],
    queryFn: () => getMailMessage({ data: { provider, id: openId! } }),
    enabled: ready && connected && !!openId,
  });

  const refreshLists = () => {
    void qc.invalidateQueries({ queryKey: ["mailbox", provider, "list"] });
    void qc.invalidateQueries({ queryKey: ["mailbox", provider, "folders"] });
  };

  async function connect(target: MailProvider) {
    setConnecting(target);
    // Google refuses to render inside the editor preview frame, so hand the
    // sign-in to a real top-level tab/window instead of a framed popup.
    const handoff = beginOAuthHandoff();
    try {
      const { authorizationUrl } = await startMailboxConnect({ data: { provider: target } });
      const pending = waitForCode();
      handoff(authorizationUrl);
      const code = await pending;
      const result = await completeMailboxConnect({ data: { code } });
      toast.success(result.email ? `Connected ${result.email}` : "Mail account connected");
      setProvider(target);
      await qc.invalidateQueries({ queryKey: ["mailbox"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect that account.");
    } finally {
      setConnecting(null);
    }
  }


  const disconnectMut = useMutation({
    mutationFn: () => disconnectMailbox({ data: { provider } }),
    onSuccess: async () => {
      toast.success("Mail account disconnected");
      setOpenId(null);
      await qc.invalidateQueries({ queryKey: ["mailbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actMut = useMutation({
    mutationFn: (vars: {
      id: string;
      action: "read" | "unread" | "star" | "unstar" | "archive" | "trash";
    }) => actOnMailMessage({ data: { provider, ...vars } }),
    onSuccess: (_r, vars) => {
      if (vars.action === "trash" || vars.action === "archive") setOpenId(null);
      refreshLists();
      void qc.invalidateQueries({ queryKey: ["mailbox", provider, "message"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = listQ.data?.items ?? [];
  const folders = foldersQ.data ?? [];
  const notConnectedError =
    listQ.error instanceof Error && listQ.error.message.includes("NOT_CONNECTED");

  const meta = useMemo(
    () =>
      accounts.map((a) => (
        <button
          key={a.provider}
          type="button"
          onClick={() => setProvider(a.provider)}
          className={[
            "rounded-full border px-3 py-1 text-xs transition-colors",
            a.provider === provider
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {PROVIDER_LABEL[a.provider]}
          {a.connected ? ` · ${a.email ?? "connected"}` : a.available ? " · not linked" : " · unavailable"}
        </button>
      )),
    [accounts, provider],
  );

  return (
    <AppShell>
      <PageHeader
        title="Mailbox"
        description="Sign in to your own Gmail or Outlook account and work through your email without leaving the CRM."
        crumbs={[{ label: "Communication" }, { label: "Mailbox" }]}
        meta={meta}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshLists}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              <RefreshCw className={`size-3.5 ${listQ.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {connected ? (
              <>
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90"
                >
                  <Plus className="size-3.5" /> New email
                </button>
                <button
                  type="button"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Unplug className="size-3.5" /> Disconnect
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <PageBody>
        {!ready || accountsQ.isLoading ? (
          <TableSkeleton rows={6} />
        ) : !connected || notConnectedError ? (
          <ConnectPanel
            available={!!active?.available}
            provider={provider}
            connecting={connecting}
            onConnect={connect}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[200px_320px_1fr]">
            {/* Folders */}
            <aside className="rounded-lg border border-border bg-card p-2">
              <p className="px-2 pb-2 pt-1 eyebrow">Folders</p>
              {foldersQ.isLoading ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
              ) : (
                <ul className="space-y-0.5">
                  {folders.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFolderId(f.id);
                          setOpenId(null);
                        }}
                        className={[
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          folderId === f.id
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="truncate">{f.name}</span>
                        {f.unread ? (
                          <span className="ml-2 rounded-full bg-foreground px-1.5 text-[10px] text-background">
                            {f.unread}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            {/* Message list */}
            <section className="flex min-h-[60vh] flex-col rounded-lg border border-border bg-card">
              <form
                className="flex items-center gap-2 border-b border-border px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                  setOpenId(null);
                }}
              >
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search your email"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                {search ? (
                  <button
                    type="button"
                    className="text-[10px] uppercase text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </form>

              <div className="flex-1 overflow-y-auto">
                {listQ.isLoading ? (
                  <div className="p-3">
                    <TableSkeleton rows={6} />
                  </div>
                ) : listQ.error ? (
                  <ErrorState error={listQ.error} onRetry={() => void listQ.refetch()} />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={Mail}
                    title="Nothing here"
                    description={search ? "No email matched that search." : "This folder is empty."}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenId(item.id);
                            if (item.unread) actMut.mutate({ id: item.id, action: "read" });
                          }}
                          className={[
                            "flex w-full gap-3 px-3 py-2.5 text-left transition-colors",
                            openId === item.id ? "bg-muted" : "hover:bg-muted/60",
                          ].join(" ")}
                        >
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                            {initialsFor(displayName(item))}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-xs ${item.unread ? "font-semibold" : ""}`}
                              >
                                {displayName(item)}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {when(item.date)}
                              </span>
                            </span>
                            <span
                              className={`mt-0.5 block truncate text-xs ${item.unread ? "font-medium" : "text-muted-foreground"}`}
                            >
                              {item.subject}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {item.hasAttachments ? <Paperclip className="size-3" /> : null}
                              {item.starred ? <Star className="size-3 fill-current" /> : null}
                              <span className="truncate">{item.snippet}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Reader */}
            <section className="min-h-[60vh] rounded-lg border border-border bg-card">
              {!openId ? (
                <EmptyState
                  icon={Mail}
                  title="Pick an email"
                  description="Choose a message on the left to read it here."
                />
              ) : messageQ.isLoading ? (
                <div className="p-4">
                  <TableSkeleton rows={5} />
                </div>
              ) : messageQ.error ? (
                <ErrorState error={messageQ.error} onRetry={() => void messageQ.refetch()} />
              ) : messageQ.data ? (
                <MessageView
                  message={messageQ.data}
                  onAction={(action) => actMut.mutate({ id: messageQ.data!.id, action })}
                  onReply={() => setComposeOpen(true)}
                />
              ) : null}
            </section>
          </div>
        )}
      </PageBody>

      {composeOpen ? (
        <ComposeDialog
          provider={provider}
          reply={
            messageQ.data && openId
              ? {
                  to: messageQ.data.from,
                  subject: messageQ.data.subject.startsWith("Re:")
                    ? messageQ.data.subject
                    : `Re: ${messageQ.data.subject}`,
                  threadId: messageQ.data.threadId,
                  inReplyToMessageId: messageQ.data.id,
                }
              : null
          }
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            refreshLists();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ConnectPanel({
  available,
  provider,
  connecting,
  onConnect,
}: {
  available: boolean;
  provider: MailProvider;
  connecting: MailProvider | null;
  onConnect: (p: MailProvider) => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
        <Mail className="size-5" />
      </span>
      <h2 className="mt-3 font-display text-base font-semibold">
        Connect your {PROVIDER_LABEL[provider]} account
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        You sign in with your own email account. Only you can see your messages — nobody else on
        the account can read them.
      </p>
      {available ? (
        <button
          type="button"
          onClick={() => onConnect(provider)}
          disabled={connecting === provider}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-xs text-background hover:opacity-90 disabled:opacity-60"
        >
          {connecting === provider ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Mail className="size-3.5" />
          )}
          Sign in with {PROVIDER_LABEL[provider]}
        </button>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          {PROVIDER_LABEL[provider]} sign-in has not been switched on for this account yet.
        </p>
      )}
    </div>
  );
}

function MessageView({
  message,
  onAction,
  onReply,
}: {
  message: NonNullable<Awaited<ReturnType<typeof getMailMessage>>>;
  onAction: (action: "unread" | "star" | "unstar" | "archive" | "trash") => void;
  onReply: () => void;
}) {
  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold">{message.subject}</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {displayName(message)} &lt;{message.from}&gt;
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              To {message.to}
              {message.cc ? ` · Cc ${message.cc}` : ""}
              {message.date ? ` · ${new Date(message.date).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn label="Reply" onClick={onReply} icon={Reply} />
            <IconBtn
              label={message.starred ? "Remove star" : "Star"}
              onClick={() => onAction(message.starred ? "unstar" : "star")}
              icon={Star}
              active={message.starred}
            />
            <IconBtn label="Mark unread" onClick={() => onAction("unread")} icon={Mail} />
            <IconBtn label="Archive" onClick={() => onAction("archive")} icon={Archive} />
            <IconBtn label="Delete" onClick={() => onAction("trash")} icon={Trash2} />
          </div>
        </div>

        {message.attachments.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <li
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
              >
                <Paperclip className="size-3" />
                <span className="max-w-[180px] truncate">{a.filename}</span>
                {a.size ? <span className="opacity-70">{sizeLabel(a.size)}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {message.html ? (
          <iframe
            title="Email content"
            sandbox=""
            className="h-[60vh] w-full rounded-md border border-border bg-white"
            srcDoc={message.html}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
            {message.text ?? message.snippet}
          </pre>
        )}
      </div>
    </article>
  );
}

function IconBtn({
  label,
  onClick,
  icon: Icon,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className={`size-3.5 ${active ? "fill-current text-foreground" : ""}`} />
    </button>
  );
}

function ComposeDialog({
  provider,
  reply,
  onClose,
  onSent,
}: {
  provider: MailProvider;
  reply: {
    to: string;
    subject: string;
    threadId: string | null;
    inReplyToMessageId: string;
  } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(reply?.to ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(reply?.subject ?? "");
  const [body, setBody] = useState("");

  const sendMut = useMutation({
    mutationFn: () =>
      sendMailMessage({
        data: {
          provider,
          to,
          cc: cc || null,
          subject,
          body,
          threadId: reply?.threadId ?? null,
          inReplyToMessageId: reply?.inReplyToMessageId ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Email sent");
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          sendMut.mutate();
        }}
      >
        <h2 className="font-display text-sm font-semibold">
          {reply ? "Reply" : "New email"} · {PROVIDER_LABEL[provider]}
        </h2>
        <div className="mt-3 space-y-2">
          <Field label="To" value={to} onChange={setTo} placeholder="name@example.com" required />
          <Field label="Cc" value={cc} onChange={setCc} placeholder="optional" />
          <Field label="Subject" value={subject} onChange={setSubject} />
          <label className="block">
            <span className="eyebrow">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              required
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs outline-none focus:border-foreground"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sendMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90 disabled:opacity-60"
          >
            {sendMut.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground"
      />
    </label>
  );
}

export type { MailListItem };
