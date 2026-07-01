import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil, Trash2, Mail, Phone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ContactDialog } from "@/components/ContactDialog";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  LIFECYCLE_STAGES,
  type Contact,
  type ContactInput,
  type LifecycleStage,
} from "@/lib/contacts";
import { useTenancy } from "@/lib/tenancy";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts/")({
  head: () => ({
    meta: [
      { title: "Contacts — Agency Engine" },
      { name: "description", content: "Manage your contacts, tags, and accounts." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<LifecycleStage | "all">("all");
  const subId = useTenancy((s) => s.currentSubAccountId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const contactsQuery = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });

  const contacts: Contact[] = contactsQuery.data ?? [];

  const allTags = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => c.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (activeStage !== "all" && c.lifecycle_stage !== activeStage) return false;
      if (activeTag && !(c.tags ?? []).includes(activeTag)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (c.first_name ?? "").toLowerCase().includes(q) ||
        (c.last_name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, activeTag, activeStage]);

  const createMut = useMutation({
    mutationFn: (input: ContactInput) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createContact(input, userId, subId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContactInput }) => updateContact(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-accent rounded-full" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {contacts.length} contacts
          </span>
        </div>
      }
      headerActions={
        <button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-3.5" />
          New Contact
        </button>
      }
    >
      <div className="h-full flex flex-col">
        <div className="px-6 py-3 border-b border-border flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Stage
          </span>
          <button
            onClick={() => setActiveStage("all")}
            className={
              activeStage === "all"
                ? "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-primary text-primary-foreground"
                : "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
            }
          >
            All
          </button>
          {LIFECYCLE_STAGES.map((s) => (
            <button
              key={s.value}
              onClick={() => setActiveStage(s.value)}
              className={
                activeStage === s.value
                  ? "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-primary text-primary-foreground"
                  : "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border border-border rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-64"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTag(null)}
              className={
                activeTag === null
                  ? "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-primary text-primary-foreground"
                  : "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              }
            >
              All tags
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
                className={
                  t === activeTag
                    ? "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-primary text-primary-foreground"
                    : "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {contactsQuery.isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-xs">Loading contacts…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <p className="text-xs">
                {contacts.length === 0 ? "No contacts yet." : "No matches for your filter."}
              </p>
              {contacts.length === 0 && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Add your first contact
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-2 font-bold">Name</th>
                  <th className="px-3 py-2 font-bold">Stage</th>
                  <th className="px-3 py-2 font-bold">Email</th>
                  <th className="px-3 py-2 font-bold">Phone</th>
                  <th className="px-3 py-2 font-bold">Company</th>
                  <th className="px-3 py-2 font-bold">Tags</th>
                  <th className="px-3 py-2 font-bold w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                  return (
                    <tr key={c.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="px-6 py-2.5 font-medium">
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className="hover:text-primary hover:underline text-left"
                        >
                          {name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-mono uppercase">
                          {c.lifecycle_stage}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">

                        {c.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="size-3" />
                            {c.email}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-3" />
                            {c.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {c.company ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="size-3" />
                            {c.company}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).map((t) => (
                            <span
                              key={t}
                              className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditing(c);
                              setDialogOpen(true);
                            }}
                            title="Edit"
                            className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete contact "${name}"?`)) deleteMut.mutate(c.id);
                            }}
                            title="Delete"
                            className="size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) await updateMut.mutateAsync({ id: editing.id, input });
          else await createMut.mutateAsync(input);
        }}
      />
    </AppShell>
  );
}
