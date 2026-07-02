import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Mail, Copy, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { fetchMyAgencies, fetchMySubAccounts } from "@/lib/tenancy";
import {
  buildInviteUrl,
  createInvitation,
  fetchAgencyMembers,
  fetchInvitations,
  revokeInvitation,
} from "@/lib/invitations";

export const Route = createFileRoute("/_authenticated/settings/team")({
  head: () => ({ meta: [{ title: "Team — Settings" }] }),
  component: TeamPage,
});

type RoleValue = "admin" | "member" | "client";

function TeamPage() {
  const qc = useQueryClient();
  const agenciesQ = useQuery({ queryKey: ["my-agencies"], queryFn: fetchMyAgencies });
  const subsQ = useQuery({ queryKey: ["my-sub-accounts"], queryFn: fetchMySubAccounts });

  const agency = agenciesQ.data?.[0];
  const agencyId = agency?.id;

  const invitesQ = useQuery({
    queryKey: ["invitations", agencyId],
    queryFn: () => fetchInvitations(agencyId!),
    enabled: !!agencyId,
  });

  const membersQ = useQuery({
    queryKey: ["agency-members", agencyId],
    queryFn: () => fetchAgencyMembers(agencyId!),
    enabled: !!agencyId,
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("member");
  const [subAccountId, setSubAccountId] = useState<string>("");

  const createMut = useMutation({
    mutationFn: () =>
      createInvitation({
        email,
        agency_id: agencyId!,
        role,
        sub_account_id: role === "admin" ? null : subAccountId || subsQ.data?.[0]?.id || null,
      }),
    onSuccess: ({ token }) => {
      qc.invalidateQueries({ queryKey: ["invitations", agencyId] });
      setEmail("");
      const url = buildInviteUrl(token);
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Invite created — link copied to clipboard");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create invite"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", agencyId] });
      toast.success("Invite revoked");
    },
  });

  const copyLink = async (id: string) => {
    try {
      const { fetchInvitationToken } = await import("@/lib/invitations");
      const token = await fetchInvitationToken(id);
      const url = buildInviteUrl(token);
      await navigator.clipboard?.writeText(url);
      toast.success("Link copied");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not copy link");
    }
  };

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/settings/sub-accounts" className="hover:text-foreground">Sub-accounts</Link>
          <span>·</span>
          <span className="text-foreground font-medium">Team</span>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Team & invites</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite teammates as admins, members of a workspace, or external clients.
          </p>
        </header>

        {/* Invite form */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">New invitation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_220px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (agency-wide)</SelectItem>
                  <SelectItem value="member">Member (workspace staff)</SelectItem>
                  <SelectItem value="client">Client (portal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Workspace</Label>
              <Select
                value={subAccountId}
                onValueChange={setSubAccountId}
                disabled={role === "admin"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={role === "admin" ? "—" : "Choose workspace"} />
                </SelectTrigger>
                <SelectContent>
                  {(subsQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!email || !agencyId || createMut.isPending}
            >
              {createMut.isPending ? "Creating…" : "Send invite"}
            </Button>
          </div>
        </section>

        {/* Pending invites */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Pending invites</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(invitesQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No pending invites.</p>
            ) : (
              (invitesQ.data ?? []).map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(inv.token)}>
                      <Copy className="size-3.5 mr-1.5" /> Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMut.mutate(inv.id)}
                      disabled={revokeMut.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Members */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Members</h2>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(membersQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No members yet.</p>
            ) : (
              (membersQ.data ?? []).map((m, i) => (
                <div key={`${m.user_id}-${m.scope}-${m.sub_account_id ?? "agency"}-${i}`} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name ?? m.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role}
                      {m.scope === "sub_account" && m.sub_account_name ? ` · ${m.sub_account_name}` : " · agency"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
