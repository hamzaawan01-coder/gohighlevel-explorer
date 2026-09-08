import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchRecycleBin,
  purgeRecord,
  restoreRecord,
  RECYCLE_LABELS,
  type RecycleEntity,
  type RecycleItem,
} from "@/lib/recycle-bin";

export const Route = createFileRoute("/_authenticated/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Recycle bin — Lead Convert" },
      {
        name: "description",
        content: "Restore deleted contacts, opportunities, tasks and invoices, or remove them for good.",
      },
      { property: "og:title", content: "Recycle bin — Lead Convert" },
      {
        property: "og:description",
        content: "Recover anything your team deleted by mistake, or clear it permanently.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecycleBinPage,
});

const FILTERS: { value: RecycleEntity | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "contacts", label: "Contacts" },
  { value: "deals", label: "Opportunities" },
  { value: "tasks", label: "Tasks" },
  { value: "invoices", label: "Invoices" },
];

function RecycleBinPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [filter, setFilter] = useState<RecycleEntity | "all">("all");
  const [search, setSearch] = useState("");

  const binQ = useQuery({
    queryKey: ["recycle-bin", subId],
    queryFn: () => fetchRecycleBin(subId!),
    enabled: !!subId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recycle-bin", subId] });
    for (const key of ["contacts", "tasks", "invoices", "board", "deals", "dashboard-stats"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const restoreM = useMutation({
    mutationFn: (item: RecycleItem) => restoreRecord(item.entity, item.id),
    onSuccess: () => {
      toast.success("Restored");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Only account admins can restore items"),
  });

  const purgeM = useMutation({
    mutationFn: (item: RecycleItem) => purgeRecord(item.entity, item.id),
    onSuccess: () => {
      toast.success("Deleted permanently");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Only account admins can delete permanently"),
  });

  const items = useMemo(() => {
    const rows = binQ.data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.entity === filter) &&
        (!q || (r.label ?? "").toLowerCase().includes(q)),
    );
  }, [binQ.data, filter, search]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Recycle bin</h1>
          <p className="text-sm text-muted-foreground">
            Deleted contacts, opportunities, tasks and invoices stay here until an admin removes
            them for good. Nothing is cleared automatically.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deleted items"
            className="ml-auto w-full sm:w-64"
          />
        </div>

        {binQ.isLoading ? (
          <ListSkeleton />
        ) : binQ.isError ? (
          <ErrorState
            title="Could not load the recycle bin"
            description="Only account admins and owners can view deleted items."
            onRetry={() => binQ.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Nothing deleted"
            description="Anything your team deletes will show up here, ready to restore."
          />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((item) => {
              const busy =
                (restoreM.isPending && restoreM.variables?.id === item.id) ||
                (purgeM.isPending && purgeM.variables?.id === item.id);
              return (
                <li key={`${item.entity}-${item.id}`} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {RECYCLE_LABELS[item.entity]} · deleted{" "}
                      {new Date(item.deleted_at).toLocaleString()}
                      {item.deleted_by_name ? ` by ${item.deleted_by_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => restoreM.mutate(item)}
                    >
                      {busy && restoreM.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1 h-4 w-4" />
                      )}
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete "${item.label}"? This cannot be undone.`,
                          )
                        )
                          purgeM.mutate(item);
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete forever
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
