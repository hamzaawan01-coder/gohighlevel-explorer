import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Pencil, Trash2, Mail, Phone, Building2,
  Bookmark, BookmarkPlus, X, Tag as TagIcon, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ContactDialog } from "@/components/ContactDialog";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  bulkUpdateStage, bulkDeleteContacts, bulkAddTag, bulkRemoveTag,
  fetchContactViews, createContactView, deleteContactView,
  type ContactView,
} from "@/lib/contact-bulk";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
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

  const viewsQuery = useQuery({
    queryKey: ["contact-views", subId],
    queryFn: () => fetchContactViews(subId!),
    enabled: !!subId,
  });
  const views: ContactView[] = viewsQuery.data ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setSelectedIds(new Set());
  };

  const bulkStageMut = useMutation({
    mutationFn: ({ ids, stage }: { ids: string[]; stage: LifecycleStage }) =>
      bulkUpdateStage(ids, stage),
    onSuccess: (_d, v) => {
      toast.success(`Moved ${v.ids.length} to ${v.stage.toUpperCase()}`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkTagMut = useMutation({
    mutationFn: ({ ids, tag }: { ids: string[]; tag: string }) => bulkAddTag(ids, tag),
    onSuccess: (_d, v) => {
      toast.success(`Tagged ${v.ids.length} with "${v.tag}"`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUntagMut = useMutation({
    mutationFn: ({ ids, tag }: { ids: string[]; tag: string }) => bulkRemoveTag(ids, tag),
    onSuccess: (_d, v) => {
      toast.success(`Removed "${v.tag}" from ${v.ids.length}`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteContacts(ids),
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} contacts`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveViewMut = useMutation({
    mutationFn: (name: string) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createContactView({
        name,
        filters: { search, stage: activeStage, tag: activeTag },
        subAccountId: subId,
        ownerId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-views"] });
      toast.success("View saved");
      setSaveViewOpen(false);
      setNewViewName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteViewMut = useMutation({
    mutationFn: (id: string) => deleteContactView(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-views"] });
      toast.success("View deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyView = (v: ContactView) => {
    setSearch(v.filters.search ?? "");
    setActiveStage(v.filters.stage ?? "all");
    setActiveTag(v.filters.tag ?? null);
  };

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      filteredIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([...selectedIds, ...filteredIds]));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const selectedArr = Array.from(selectedIds);
  const selectedTags = useMemo(() => {
    const s = new Set<string>();
    contacts
      .filter((c) => selectedIds.has(c.id))
      .forEach((c) => (c.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [contacts, selectedIds]);



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

        {/* Saved views */}
        <div className="px-6 py-2.5 border-b border-border flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Views
          </span>
          {views.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">
              Save a filter combination to reuse it later.
            </span>
          )}
          {views.map((v) => (
            <div key={v.id} className="inline-flex items-center rounded bg-secondary text-muted-foreground hover:text-foreground overflow-hidden">
              <button
                onClick={() => applyView(v)}
                className="text-[10px] font-mono uppercase tracking-wider pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <Bookmark className="size-2.5" /> {v.name}
              </button>
              <button
                onClick={() => { if (confirm(`Delete view "${v.name}"?`)) deleteViewMut.mutate(v.id); }}
                className="px-1 py-1 hover:text-destructive"
                title="Delete view"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setSaveViewOpen(true)}
            className="ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <BookmarkPlus className="size-2.5" /> Save view
          </button>
        </div>

        {/* Bulk actions toolbar */}
        {selectedIds.size > 0 && (
          <div className="px-6 py-2 border-b border-border bg-primary/5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] text-muted-foreground hover:text-foreground uppercase font-mono tracking-wider"
            >
              Clear
            </button>
            <div className="h-4 w-px bg-border mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger className="text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/70 inline-flex items-center gap-1">
                Set stage <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {LIFECYCLE_STAGES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => bulkStageMut.mutate({ ids: selectedArr, stage: s.value })}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/70 inline-flex items-center gap-1">
                <TagIcon className="size-3" /> Add tag <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-[10px]">Existing tags</DropdownMenuLabel>
                {allTags.length === 0 && (
                  <DropdownMenuItem disabled className="text-xs italic">
                    No tags yet
                  </DropdownMenuItem>
                )}
                {allTags.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => bulkTagMut.mutate({ ids: selectedArr, tag: t })}>
                    {t}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const tag = prompt("New tag name")?.trim();
                    if (tag) bulkTagMut.mutate({ ids: selectedArr, tag });
                  }}
                >
                  + New tag…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/70 inline-flex items-center gap-1">
                  Remove tag <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {selectedTags.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => bulkUntagMut.mutate({ ids: selectedArr, tag: t })}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} contacts? This cannot be undone.`))
                  bulkDeleteMut.mutate(selectedArr);
              }}
              className="text-[11px] px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          </div>
        )}



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

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Contact detail</DialogTitle>
          <DialogDescription className="sr-only">
            View and edit contact details, deals, tasks, notes, and events.
          </DialogDescription>
          {selectedId && (
            <ContactDetailPanel
              contactId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
