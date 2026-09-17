import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Pencil, Trash2, Mail, Phone, Building2,
  Bookmark, BookmarkPlus, X, Tag as TagIcon, ChevronDown,
  Download, Upload, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";

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
import { contactsToCsv, downloadCsv } from "@/lib/contacts-csv";
import { ContactsImportDialog } from "@/components/ContactsImportDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts/")({
  head: () => ({
    meta: [
      { title: "Contacts — Lead Convert" },
      { name: "description", content: "Manage your contacts, tags, and accounts." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              downloadCsv(
                `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
                contactsToCsv(contacts),
              );
            }}
            className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors"
            title="Export contacts to CSV"
          >
            <Download className="size-3.5" />
            Export
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors"
            title="Import contacts from CSV"
          >
            <Upload className="size-3.5" />
            Import
          </button>
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
        </div>
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

        {/* Saved views */}
        <div className="px-6 py-2.5 border-b border-border grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:flex sm:flex-wrap">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
              Views
            </span>
            {views.length === 0 && (
              <span className="truncate text-[10px] text-muted-foreground italic">
                Save a filter combination to reuse it later.
              </span>
            )}
            {views.map((v) => (
              <div key={v.id} className="inline-flex items-center rounded bg-secondary text-muted-foreground hover:text-foreground overflow-hidden">
                <button
                  onClick={() => applyView(v)}
                  className="text-[10px] font-mono uppercase tracking-wider pl-2 pr-1 py-1 flex items-center gap-1"
                >
                  <Bookmark className="size-2.5 shrink-0" /> {v.name}
                </button>
                <button
                  onClick={() => { if (confirm(`Delete view "${v.name}"?`)) deleteViewMut.mutate(v.id); }}
                  aria-label={`Delete view ${v.name}`}
                  className="px-1 py-1 hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSaveViewOpen(true)}
            className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <BookmarkPlus className="size-2.5" /> Save view
          </button>
        </div>

        {/* Bulk actions toolbar */}
        {selectedIds.size > 0 && (
          <div className="px-6 py-2 border-b border-border bg-primary/5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-medium shrink-0">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground uppercase font-mono tracking-wider"
              >
                Clear
              </button>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="hidden h-4 w-px bg-border mx-1 sm:block" />

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
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          <DataTable<Contact>
            tableKey="contacts"
            caption="Contacts"
            rows={filtered}
            isLoading={contactsQuery.isLoading}
            error={contactsQuery.isError ? contactsQuery.error : undefined}
            onRetry={() => contactsQuery.refetch()}
            rowKey={(c) => c.id}
            onRowClick={(c) => setSelectedId(c.id)}
            emptyTitle={contacts.length === 0 ? "No contacts yet" : "No matches for your filters"}
            emptyDescription={
              contacts.length === 0
                ? "Contacts are the backbone of your pipeline. Add one manually or import a CSV to get started."
                : "Try clearing the stage or tag filter, or search for something else."
            }
            emptyAction={
              contacts.length === 0 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5" />
                  Add your first contact
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setActiveTag(null);
                    setActiveStage("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
            toolbar={
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <input
                  type="text"
                  data-page-search
                  placeholder="Filter contacts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-secondary border border-border rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-64"
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
            }
            columns={[
              {
                key: "select",
                header: (
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                ),
                locked: true,
                className: "w-8",
                cell: (c) => (
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleOne(c.id)}
                    aria-label={`Select ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "contact"}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
              {
                key: "name",
                header: "Name",
                sortValue: (c) => [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase(),
                locked: true,
                cell: (c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(c.id);
                      }}
                      className="min-w-0 truncate font-medium hover:text-primary hover:underline text-left"
                    >
                      {name}
                    </button>
                  );
                },
              },
              {
                key: "stage",
                header: "Stage",
                sortValue: (c) => c.lifecycle_stage,
                cell: (c) => (
                  <span className="inline-block bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-mono uppercase">
                    {c.lifecycle_stage}
                  </span>
                ),
              },
              {
                key: "email",
                header: "Email",
                sortValue: (c) => c.email ?? "",
                cell: (c) => (
                  <span className="text-muted-foreground">
                    {c.email ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                ),
              },
              {
                key: "phone",
                header: "Phone",
                sortValue: (c) => c.phone ?? "",
                hidden: true,
                cell: (c) => (
                  <span className="text-muted-foreground">
                    {c.phone ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Phone className="size-3 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                ),
              },
              {
                key: "company",
                header: "Company",
                sortValue: (c) => c.company ?? "",
                cell: (c) => (
                  <span className="text-muted-foreground">
                    {c.company ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Building2 className="size-3 shrink-0" />
                        <span className="truncate">{c.company}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                ),
              },
              {
                key: "tags",
                header: "Tags",
                cell: (c) => (
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
                ),
              },
              {
                key: "actions",
                header: "",
                locked: true,
                className: "w-20",
                cell: (c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "this contact";
                  return (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(c);
                          setDialogOpen(true);
                        }}
                        aria-label={`Edit ${name}`}
                        title="Edit"
                        className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete contact "${name}"?`)) deleteMut.mutate(c.id);
                        }}
                        aria-label={`Delete ${name}`}
                        title="Delete"
                        className="size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                },
              },
            ]}
          />
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

      {userId && subId && (
        <ContactsImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          ownerId={userId}
          subAccountId={subId}
        />
      )}

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Contact detail</DialogTitle>
          <DialogDescription className="sr-only">
            View and edit contact details, deals, tasks, notes, and events.
          </DialogDescription>
          {selectedId && (
            <>
              <div className="flex justify-end px-4 pt-3">
                <Link
                  to="/contacts/$id"
                  params={{ id: selectedId }}
                  onClick={() => setSelectedId(null)}
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open full page <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <ContactDetailPanel
                contactId={selectedId}
                onClose={() => setSelectedId(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Save the current filter combination so you can jump back to it later.
          </DialogDescription>
          <div className="space-y-3 mt-2">
            <input
              autoFocus
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. MQLs I own"
              className="w-full bg-secondary border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newViewName.trim()) saveViewMut.mutate(newViewName.trim());
              }}
            />
            <div className="text-[11px] text-muted-foreground space-y-1 rounded-md bg-secondary/60 p-3">
              <div>Stage: <span className="font-mono uppercase">{activeStage}</span></div>
              <div>Tag: <span className="font-mono">{activeTag ?? "any"}</span></div>
              <div>Search: <span className="font-mono">{search || "—"}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSaveViewOpen(false)}
                className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => saveViewMut.mutate(newViewName.trim())}
                disabled={!newViewName.trim() || saveViewMut.isPending}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
