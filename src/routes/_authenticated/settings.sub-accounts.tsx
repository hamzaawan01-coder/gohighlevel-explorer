import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveSubAccount,
  createSubAccount,
  fetchMyAgencies,
  fetchMySubAccounts,
  useTenancy,
} from "@/lib/tenancy";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/sub-accounts")({
  head: () => ({
    meta: [{ title: "Sub-accounts — Settings" }],
  }),
  component: SubAccountsPage,
});

function SubAccountsPage() {
  const queryClient = useQueryClient();
  const { setCurrent } = useTenancy();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");

  const agenciesQ = useQuery({ queryKey: ["my-agencies"], queryFn: fetchMyAgencies });
  const subsQ = useQuery({ queryKey: ["my-sub-accounts"], queryFn: fetchMySubAccounts });

  const agencies = agenciesQ.data ?? [];
  const subs = subsQ.data ?? [];

  const createMut = useMutation({
    mutationFn: () =>
      createSubAccount({ agency_id: agencyId || agencies[0]?.id, name, industry: industry || null }),
    onSuccess: (sub) => {
      queryClient.invalidateQueries({ queryKey: ["my-sub-accounts"] });
      setCurrent(sub.id);
      toast.success(`Created "${sub.name}"`);
      setName("");
      setIndustry("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { currentSubAccountId } = useTenancy();
  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveSubAccount(id),
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: ["my-sub-accounts"] });
      if (currentSubAccountId === id) setCurrent(null);
      toast.success("Sub-account removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-foreground font-medium">Sub-accounts</span>
          <span>·</span>
          <Link to="/settings/team" className="hover:text-foreground">Team</Link>
        </div>
      }
      headerActions={
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-3.5" />
          New sub-account
        </button>
      }
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 overflow-auto h-full">
        <SettingsShell>
        <div>
          <h1 className="text-lg font-bold">Sub-accounts</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Each sub-account is an isolated client workspace with its own contacts, deals,
            and conversations.{" "}
            <Link to="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
          </p>
        </div>

        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createMut.mutate();
            }}
            className="bg-card border border-border rounded-lg p-4 space-y-3 max-w-xl"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sa-name">Name</Label>
                <Input
                  id="sa-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Joe's HVAC"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sa-industry">Industry</Label>
                <Input
                  id="sa-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="HVAC, Dental, Marketing…"
                />
              </div>
            </div>
            {agencies.length > 1 && (
              <div className="space-y-2">
                <Label>Parent agency</Label>
                <Select value={agencyId || agencies[0]?.id} onValueChange={setAgencyId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {subs.map((s) => {
            const agency = agencies.find((a) => a.id === s.agency_id);
            return (
              <button
                key={s.id}
                onClick={() => setCurrent(s.id)}
                className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded bg-accent/15 text-accent flex items-center justify-center">
                    <Building2 className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {agency?.name ?? "Agency"} · {s.industry ?? "General"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsShell>
      </div>
    </AppShell>
  );
}
