import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, MessageSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { fetchContacts, type Contact } from "@/lib/contacts";
import {
  fetchConversations,
  ensureConversation,
  fetchMessages,
  postNote,
  type Conversation,
} from "@/lib/conversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { initials, stringHue } from "@/lib/initials";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — Agency Engine" },
      { name: "description", content: "Internal notes on your contacts." },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });
  const convosQ = useQuery({
    queryKey: ["conversations", subId],
    queryFn: () => fetchConversations(subId!),
    enabled: !!subId,
  });

  const contacts = contactsQ.data ?? [];
  const convos = convosQ.data ?? [];
  const convoByContact = useMemo(
    () => new Map(convos.map((c) => [c.contact_id, c])),
    [convos],
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withActivity = [...contacts].sort((a, b) => {
      const at = convoByContact.get(a.id)?.last_message_at ?? "";
      const bt = convoByContact.get(b.id)?.last_message_at ?? "";
      return bt.localeCompare(at);
    });
    if (!q) return withActivity;
    return withActivity.filter((c) => displayName(c).toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
  }, [contacts, convoByContact, search]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;
  const selectedConvoId = selectedContactId ? convoByContact.get(selectedContactId)?.id ?? null : null;

  const ensureMut = useMutation({
    mutationFn: () => {
      if (!subId || !selectedContactId) throw new Error("Not ready");
      return ensureConversation(subId, selectedContactId);
    },
    onSuccess: (c: Conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", c.id] });
    },
  });

  const msgsQ = useQuery({
    queryKey: ["messages", selectedConvoId],
    queryFn: () => fetchMessages(selectedConvoId!),
    enabled: !!selectedConvoId,
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!userId || !subId || !selectedContactId) throw new Error("Not ready");
      const convo = selectedConvoId
        ? { id: selectedConvoId }
        : await ensureConversation(subId, selectedContactId);
      return postNote({
        conversation_id: convo.id,
        sub_account_id: subId,
        author_user_id: userId,
        body: body.trim(),
      });
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages"] });
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!msgsQ.data) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgsQ.data]);

  return (
    <AppShell>
      <div className="h-full flex">
        <aside className="w-72 border-r border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Contacts
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {contactsQ.isLoading ? (
              <div className="p-4 text-xs text-muted-foreground">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No contacts yet.</div>
            ) : (
              <ul>
                {contacts.map((c) => {
                  const name = displayName(c);
                  const convo = convoByContact.get(c.id);
                  const active = c.id === selectedContactId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setSelectedContactId(c.id);
                          if (!convo) ensureMut.mutate();
                        }}
                        className={
                          "w-full text-left px-4 py-2.5 flex flex-col gap-0.5 border-b border-border " +
                          (active ? "bg-secondary" : "hover:bg-secondary/50")
                        }
                      >
                        <span className="text-xs font-medium truncate">{name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {convo?.last_message_at
                            ? formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })
                            : "No notes yet"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {!selectedContact ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="size-8 opacity-40" />
              <p className="text-xs">Pick a contact to see internal notes.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-border">
                <p className="text-sm font-semibold">{displayName(selectedContact)}</p>
                <p className="text-[11px] text-muted-foreground">
                  Internal notes · {selectedContact.email ?? "no email"}
                </p>
              </div>
              <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
                {msgsQ.isLoading ? (
                  <div className="flex items-center justify-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span className="text-xs">Loading…</span>
                  </div>
                ) : (msgsQ.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center">
                    No notes yet. Start the thread below.
                  </p>
                ) : (
                  (msgsQ.data ?? []).map((m) => (
                    <div key={m.id} className="rounded-md bg-secondary/60 px-3 py-2">
                      <p className="text-xs whitespace-pre-wrap">{m.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border p-4 flex gap-2">
                <Textarea
                  rows={2}
                  placeholder="Add an internal note…"
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
                <Button
                  onClick={() => sendMut.mutate()}
                  disabled={!body.trim() || sendMut.isPending}
                  className="self-end"
                >
                  <Send className="size-3.5 mr-1" />
                  Post
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function displayName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
}
