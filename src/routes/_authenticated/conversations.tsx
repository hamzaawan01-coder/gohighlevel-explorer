import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, MessageSquare, Search, Inbox, ArrowLeft, Star, UserCheck, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy, fetchMySubAccounts } from "@/lib/tenancy";
import { fetchAgencyMembers } from "@/lib/invitations";
import { fetchContacts, type Contact } from "@/lib/contacts";
import {
  fetchConversations,
  ensureConversation,
  fetchMessages,
  postMessage,
  updateConversation,
  markConversationRead,
  isUnread,
  filterConversations,
  CONVERSATION_STATUSES,
  type Conversation,
  type ConversationStatus,
  type MessageChannel,
} from "@/lib/conversations";
import { sendTwilioSms, sendTwilioWhatsapp } from "@/lib/twilio.functions";
import { suggestReply } from "@/lib/ai-assistant.functions";
import { CHANNELS, CHANNEL_BY_KEY } from "@/lib/channels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { initials, stringHue } from "@/lib/initials";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — Agency Engine" },
      {
        name: "description",
        content:
          "Unified inbox across Email, SMS, WhatsApp, Instagram, Messenger, LinkedIn, TikTok and internal notes.",
      },
    ],
  }),
  component: ConversationsPage,
});

type FilterKey = "all" | MessageChannel;
type StatusFilter = "all" | ConversationStatus;
type AssignFilter = "all" | "mine" | "unassigned";

function ConversationsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [composeChannel, setComposeChannel] = useState<MessageChannel>("note");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });
  const subAccountsQ = useQuery({
    queryKey: ["my-sub-accounts"],
    queryFn: fetchMySubAccounts,
  });
  const agencyId = (subAccountsQ.data ?? []).find((s) => s.id === subId)?.agency_id ?? null;
  const membersQ = useQuery({
    queryKey: ["agency-members", agencyId],
    queryFn: () => fetchAgencyMembers(agencyId!),
    enabled: !!agencyId,
  });
  const members = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of membersQ.data ?? []) {
      if (!seen.has(m.user_id)) seen.set(m.user_id, m.full_name || "Teammate");
    }
    return Array.from(seen, ([user_id, name]) => ({ user_id, name }));
  }, [membersQ.data]);
  const memberName = (id: string | null) =>
    id ? members.find((m) => m.user_id === id)?.name ?? "Assigned" : "Unassigned";

  const convosQ = useQuery({
    queryKey: ["conversations", subId],
    queryFn: () => fetchConversations(subId!),
    enabled: !!subId,
  });

  const contacts = contactsQ.data ?? [];
  const convos = convosQ.data ?? [];
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  // Channel counts across all conversations
  const channelCounts = useMemo(() => {
    const m: Record<string, number> = { all: convos.length };
    for (const c of convos) m[c.channel] = (m[c.channel] ?? 0) + 1;
    return m;
  }, [convos]);

  const filteredConvos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterConversations(convos, {
      channel: filter,
      status: statusFilter,
      assignee: assignFilter,
      currentUserId: userId,
    })
      .filter((c) => {
        if (!q) return true;
        const contact = contactById.get(c.contact_id);
        if (!contact) return false;
        return (
          displayName(contact).toLowerCase().includes(q) ||
          (contact.email ?? "").toLowerCase().includes(q)
        );
      });
  }, [convos, filter, statusFilter, assignFilter, userId, search, contactById]);

  // Fallback: contacts without a conversation yet — surface them at bottom of the list
  const orphanContacts = useMemo(() => {
    if (filter !== "all" && filter !== "note") return [];
    if (statusFilter === "closed" || statusFilter === "pending") return [];
    if (assignFilter !== "all") return [];
    const hasConvo = new Set(convos.map((c) => c.contact_id));
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => !hasConvo.has(c.id))
      .filter(
        (c) =>
          !q ||
          displayName(c).toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
  }, [contacts, convos, filter, statusFilter, assignFilter, search]);

  const selectedConvo = convos.find((c) => c.id === selectedConvoId) ?? null;
  const selectedContact = selectedConvo ? contactById.get(selectedConvo.contact_id) ?? null : null;
  const selectedChannel = selectedConvo?.channel ?? "note";

  useEffect(() => {
    // keep compose channel in sync with the selected conversation
    if (selectedConvo) setComposeChannel(selectedConvo.channel);
  }, [selectedConvo]);

  const openForContact = useMutation({
    mutationFn: async ({
      contactId,
      channel,
    }: {
      contactId: string;
      channel: MessageChannel;
    }) => {
      if (!subId) throw new Error("Not ready");
      return ensureConversation(subId, contactId, channel);
    },
    onSuccess: (c: Conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations", subId] });
      setSelectedConvoId(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateConversation>[1] }) =>
      updateConversation(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", subId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Mark the open thread as read.
  useEffect(() => {
    if (!selectedConvo || !isUnread(selectedConvo)) return;
    markConversationRead(selectedConvo.id)
      .then(() => qc.invalidateQueries({ queryKey: ["conversations", subId] }))
      .catch(() => undefined);
  }, [selectedConvo, qc, subId]);

  const msgsQ = useQuery({
    queryKey: ["messages", selectedConvoId],
    queryFn: () => fetchMessages(selectedConvoId!),
    enabled: !!selectedConvoId,
  });

  const sendSmsFn = useServerFn(sendTwilioSms);
  const sendWaFn = useServerFn(sendTwilioWhatsapp);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!userId || !subId || !selectedConvo) throw new Error("Not ready");
      if (composeChannel === "sms") {
        return sendSmsFn({
          data: {
            subAccountId: subId,
            conversationId: selectedConvo.id,
            body: body.trim(),
          },
        });
      }
      if (composeChannel === "whatsapp") {
        return sendWaFn({
          data: {
            subAccountId: subId,
            conversationId: selectedConvo.id,
            body: body.trim(),
          },
        });
      }
      return postMessage({
        conversation_id: selectedConvo.id,
        sub_account_id: subId,
        author_user_id: userId,
        body: body.trim(),
        channel: composeChannel,
      });
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["conversations", subId] });
      qc.invalidateQueries({ queryKey: ["messages", selectedConvoId] });
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({
          top: threadRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!msgsQ.data) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgsQ.data]);

  // Realtime: refresh the open thread + conversation list when new rows land.
  useEffect(() => {
    if (!subId) return;
    const channel = supabase
      .channel(`convos-${subId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `sub_account_id=eq.${subId}` },
        () => qc.invalidateQueries({ queryKey: ["conversations", subId] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sub_account_id=eq.${subId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["conversations", subId] });
          const convoId = (payload.new as { conversation_id?: string } | null)?.conversation_id;
          if (convoId) qc.invalidateQueries({ queryKey: ["messages", convoId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [subId, qc]);

  const suggestReplyFn = useServerFn(suggestReply);
  const draftMut = useMutation({
    mutationFn: async () => {
      if (!selectedConvoId) throw new Error("Open a conversation first");
      return suggestReplyFn({
        data: { conversationId: selectedConvoId, origin: window.location.origin },
      });
    },
    onSuccess: (res) => {
      setBody(res.draft);
      if (res.escalate) {
        toast.warning("Suggested handing this to a human", {
          description: res.escalation_reason || undefined,
        });
      } else {
        toast.success("Draft ready — review before sending");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isRealChannel = composeChannel !== "note";
  const placeholder =
    composeChannel === "sms"
      ? "Type SMS message (sent via your Twilio number)…"
      : composeChannel === "whatsapp"
      ? "Type WhatsApp message (sent via your Twilio WhatsApp sender)…"
      : isRealChannel
      ? `Send via ${CHANNEL_BY_KEY[composeChannel].label} (logged only until integration is connected)…`
      : "Add an internal note…";

  return (
    <AppShell>
      <h1 className="sr-only">Conversations</h1>
      <div className="h-full flex flex-col md:flex-row">
        {/* Channel filter rail */}
        <aside className="w-full md:w-14 border-b md:border-b-0 md:border-r border-border bg-card flex flex-row md:flex-col items-center py-1.5 md:py-3 gap-1 shrink-0 overflow-x-auto">
          <ChannelPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={channelCounts.all ?? 0}
            icon={Inbox}
            color="text-primary"
            bg="bg-primary/10"
          />
          <div className="h-px w-6 bg-border my-1" />
          {CHANNELS.map((ch) => (
            <ChannelPill
              key={ch.key}
              active={filter === ch.key}
              onClick={() => setFilter(ch.key)}
              label={ch.label}
              count={channelCounts[ch.key] ?? 0}
              icon={ch.icon}
              color={ch.color}
              bg={ch.bg}
            />
          ))}
        </aside>

        {/* Conversations list */}
        <aside
          className={`w-full md:w-80 border-r border-border bg-card flex-col min-h-0 ${
            selectedConvoId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="px-3 py-2.5 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                {filter === "all" ? "All conversations" : CHANNEL_BY_KEY[filter].label}
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {filteredConvos.length}
              </span>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
              {([{ key: "open", label: "Open" }, { key: "pending", label: "Pending" }, { key: "closed", label: "Closed" }, { key: "all", label: "All" }] as { key: StatusFilter; label: string }[]).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={statusFilter === s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    statusFilter === s.key
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value as AssignFilter)}
              aria-label="Filter by assignee"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-[11px]"
            >
              <option value="all">Everyone</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <div className="relative">
              <Search aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search conversations"
                data-page-search
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {convosQ.isError || contactsQ.isError ? (
              <ErrorState
                compact
                onRetry={() => {
                  convosQ.refetch();
                  contactsQ.refetch();
                }}
              />
            ) : convosQ.isLoading || contactsQ.isLoading ? (
              <div className="p-3">
                <ListSkeleton rows={5} />
              </div>
            ) : filteredConvos.length === 0 && orphanContacts.length === 0 ? (
              <EmptyState
                compact
                icon={Inbox}
                title={filter === "all" ? "No conversations yet" : `No ${CHANNEL_BY_KEY[filter].label} threads`}
                description="Start a conversation from a contact to see it here."
              />
            ) : (
              <ul>
                {filteredConvos.map((c) => {
                  const contact = contactById.get(c.contact_id);
                  if (!contact) return null;
                  const name = displayName(contact);
                  const active = c.id === selectedConvoId;
                  const hue = stringHue(contact.id);
                  const meta = CHANNEL_BY_KEY[c.channel];
                  const Icon = meta.icon;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedConvoId(c.id)}
                        className={
                          "w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-border transition-colors " +
                          (active ? "bg-secondary" : "hover:bg-secondary/50")
                        }
                      >
                        <span className="relative shrink-0">
                          <span
                            className="size-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                            style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
                          >
                            {initials(name)}
                          </span>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 size-4 rounded-full ring-2 ring-card flex items-center justify-center ${meta.bg}`}
                            title={meta.label}
                          >
                            <Icon className={`size-2.5 ${meta.color}`} />
                          </span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate flex items-center gap-1 ${isUnread(c) ? "font-bold" : "font-medium"}`}>
                            {c.priority && <Star className="size-3 shrink-0 text-amber-500 fill-amber-500" />}
                            <span className="truncate">{name}</span>
                            {isUnread(c) && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c.assigned_to_user_id ? `${memberName(c.assigned_to_user_id)} · ` : ""}
                            {(c.status ?? "open") !== "open" ? `${c.status} · ` : ""}
                            {meta.label} ·{" "}
                            {c.last_message_at
                              ? formatDistanceToNow(new Date(c.last_message_at), {
                                  addSuffix: true,
                                })
                              : "New"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}

                {orphanContacts.length > 0 && (
                  <li className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/40">
                    Contacts without a thread
                  </li>
                )}
                {orphanContacts.map((c) => {
                  const name = displayName(c);
                  const hue = stringHue(c.id);
                  return (
                    <li key={"orphan-" + c.id}>
                      <button
                        onClick={() =>
                          openForContact.mutate({
                            contactId: c.id,
                            channel: filter === "all" ? "note" : filter,
                          })
                        }
                        className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-border hover:bg-secondary/50"
                      >
                        <span
                          className="size-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                          style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
                        >
                          {initials(name)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            Start a conversation
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <div
          className={`flex-1 flex-col min-w-0 min-h-0 ${
            selectedConvoId ? "flex" : "hidden md:flex"
          }`}
        >
          {!selectedConvo || !selectedContact ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="size-8 opacity-40" />
              <p className="text-xs">Pick a conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="px-3 sm:px-6 py-3 border-b border-border flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedConvoId(null)}
                  aria-label="Back to conversation list"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span
                  className="size-8 shrink-0 rounded-full hidden sm:flex items-center justify-center text-[11px] font-semibold text-white"
                  style={{ backgroundColor: `hsl(${stringHue(selectedContact.id)} 60% 45%)` }}
                >
                  {initials(displayName(selectedContact))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {displayName(selectedContact)}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <ChannelBadge channel={selectedChannel} />
                    {selectedContact.email ?? "no email"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    title={selectedConvo.priority ? "Remove priority" : "Mark as priority"}
                    aria-label={selectedConvo.priority ? "Remove priority" : "Mark as priority"}
                    aria-pressed={selectedConvo.priority}
                    disabled={patchMut.isPending}
                    onClick={() =>
                      patchMut.mutate({ id: selectedConvo.id, patch: { priority: !selectedConvo.priority } })
                    }
                    className="size-8 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star className={`size-3.5 ${selectedConvo.priority ? "text-amber-500 fill-amber-500" : ""}`} />
                  </button>
                  <label className="sr-only" htmlFor="convo-assignee">Assignee</label>
                  <div className="relative">
                    <UserCheck aria-hidden className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <select
                      id="convo-assignee"
                      value={selectedConvo.assigned_to_user_id ?? ""}
                      disabled={patchMut.isPending}
                      onChange={(e) =>
                        patchMut.mutate({
                          id: selectedConvo.id,
                          patch: { assigned_to_user_id: e.target.value || null },
                        })
                      }
                      className="h-8 rounded-md border border-input bg-background pl-6 pr-2 text-[11px] max-w-[140px]"
                    >
                      <option value="">Unassigned</option>
                      {userId && !members.some((m) => m.user_id === userId) && (
                        <option value={userId}>Me</option>
                      )}
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_id === userId ? `${m.name} (me)` : m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="sr-only" htmlFor="convo-status">Status</label>
                  <select
                    id="convo-status"
                    value={selectedConvo.status ?? "open"}
                    disabled={patchMut.isPending}
                    onChange={(e) =>
                      patchMut.mutate({
                        id: selectedConvo.id,
                        patch: { status: e.target.value as ConversationStatus },
                      })
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-[11px]"
                  >
                    {CONVERSATION_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="hidden lg:flex items-center gap-1">
                  {CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    const active = ch.key === selectedChannel;
                    return (
                      <button
                        key={ch.key}
                        title={`Open ${ch.label} thread`}
                        aria-label={`Open ${ch.label} thread`}
                        aria-pressed={active}
                        onClick={() =>
                          openForContact.mutate({
                            contactId: selectedContact.id,
                            channel: ch.key,
                          })
                        }
                        className={`min-h-11 min-w-11 sm:size-7 rounded flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? `${ch.bg} ${ch.color}`
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon className="size-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div ref={threadRef} className="flex-1 overflow-auto px-3 sm:px-6 py-4 space-y-3 bg-secondary/20">
                {msgsQ.isError ? (
                  <ErrorState compact onRetry={() => msgsQ.refetch()} />
                ) : msgsQ.isLoading ? (
                  <div className="flex items-center justify-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span className="text-xs">Loading…</span>
                  </div>
                ) : (msgsQ.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center">
                    No messages yet. Start the thread below.
                  </p>
                ) : (
                  (msgsQ.data ?? []).map((m) => {
                    const meta = CHANNEL_BY_KEY[m.channel];
                    const Icon = meta.icon;
                    const outbound = m.direction === "outbound";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            outbound
                              ? "bg-primary text-primary-foreground"
                              : "bg-card ring-1 ring-border"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <Icon className="size-3" />
                            <span className="text-[10px] font-mono uppercase tracking-wider">
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[10px] opacity-70 mt-1">
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border p-3 space-y-2 bg-card">
                <div className="flex items-center gap-1 flex-wrap">
                  {CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    const active = composeChannel === ch.key;
                    return (
                      <button
                        key={ch.key}
                        onClick={() => setComposeChannel(ch.key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                          active
                            ? `${ch.bg} ${ch.color} font-medium`
                            : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon className="size-3" />
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder={placeholder}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                        e.preventDefault();
                        sendMut.mutate();
                      }
                    }}
                    className="flex-1 resize-none"
                  />
                  <div className="flex flex-col gap-2 self-end">
                    <Button
                      variant="outline"
                      onClick={() => draftMut.mutate()}
                      disabled={draftMut.isPending || !selectedConvoId}
                      title="Draft a reply with AI — nothing sends automatically"
                    >
                      {draftMut.isPending ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <Bot className="size-3.5 mr-1" />
                      )}
                      AI draft
                    </Button>
                    <Button
                      onClick={() => sendMut.mutate()}
                      disabled={!body.trim() || sendMut.isPending}
                    >
                      <Send className="size-3.5 mr-1" />
                      {composeChannel === "note" ? "Post" : "Send"}
                    </Button>
                  </div>
                </div>
                {isRealChannel && (
                  <p className="text-[10px] text-muted-foreground">
                    {CHANNEL_BY_KEY[composeChannel].label} sending isn't connected yet —
                    messages are logged internally. Connect the integration to send for real.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ChannelPill({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  color,
  bg,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label}${count ? ` · ${count}` : ""}`}
      aria-label={`${label}${count ? ` · ${count} conversations` : ""}`}
      aria-pressed={active}
      className={`relative min-h-11 min-w-11 md:size-10 rounded-lg flex items-center justify-center transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? `${bg} ${color} ring-1 ring-border`
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-mono flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function ChannelBadge({ channel }: { channel: MessageChannel }) {
  const meta = CHANNEL_BY_KEY[channel];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} font-medium mr-1`}
    >
      <Icon className="size-2.5" />
      {meta.label}
    </span>
  );
}

function displayName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
}
