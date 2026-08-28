import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { PageHeader, HeaderStat, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Phone, PhoneIncoming, PhoneOutgoing, Voicemail } from "lucide-react";
import { useTenancy } from "@/lib/tenancy";
import { listPhoneCalls, listVoicemails, markVoicemailListened } from "@/lib/twilio.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Calls & voicemail — CRM" },
      { name: "description", content: "Browser dialer call history, recordings, and voicemail inbox." },
    ],
  }),
  component: CallsPage,
});

type CallRow = {
  id: string;
  direction: string;
  from_number: string;
  to_number: string;
  status: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  recording_url: string | null;
};

function CallsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const listCalls = useServerFn(listPhoneCalls);
  const listVms = useServerFn(listVoicemails);
  const markVm = useServerFn(markVoicemailListened);
  const qc = useQueryClient();

  const calls = useQuery({
    queryKey: ["phone-calls", subId],
    queryFn: () => listCalls({ data: { subAccountId: subId! } }),
    enabled: !!subId,
  });
  const vms = useQuery({
    queryKey: ["voicemails", subId],
    queryFn: () => listVms({ data: { subAccountId: subId! } }),
    enabled: !!subId,
  });
  const unread = useMemo(() => (vms.data ?? []).filter((v: any) => !v.listened_at).length, [vms.data]);

  const markMut = useMutation({
    mutationFn: (id: string) => markVm({ data: { subAccountId: subId!, voicemailId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voicemails", subId] }),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const columns: Column<CallRow>[] = [
    {
      key: "direction",
      header: "Direction",
      cell: (c) =>
        c.direction === "inbound" ? (
          <PhoneIncoming className="size-4 shrink-0 text-green-600" aria-label="Inbound call" />
        ) : (
          <PhoneOutgoing className="size-4 shrink-0 text-blue-600" aria-label="Outbound call" />
        ),
      sortValue: (c) => c.direction,
    },
    {
      key: "from",
      header: "From",
      cell: (c) => <span className="block min-w-0 truncate font-mono text-xs">{c.from_number}</span>,
      sortValue: (c) => c.from_number,
    },
    {
      key: "to",
      header: "To",
      cell: (c) => <span className="block min-w-0 truncate font-mono text-xs">{c.to_number}</span>,
      sortValue: (c) => c.to_number,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <Badge variant="outline">{c.status ?? "—"}</Badge>,
      sortValue: (c) => c.status ?? "",
    },
    {
      key: "duration",
      header: "Duration",
      cell: (c) => (c.duration_seconds ? `${c.duration_seconds}s` : "—"),
      sortValue: (c) => c.duration_seconds ?? 0,
    },
    {
      key: "started",
      header: "Started",
      cell: (c) => (
        <span className="block min-w-0 truncate text-xs">
          {c.started_at ? new Date(c.started_at).toLocaleString() : "—"}
        </span>
      ),
      sortValue: (c) => (c.started_at ? new Date(c.started_at).getTime() : 0),
    },
    {
      key: "recording",
      header: "Recording",
      cell: (c) =>
        c.recording_url ? (
          <audio controls src={c.recording_url} className="h-8 max-w-full" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Phone className="size-5 shrink-0" /> Calls
          </span>
        }
        description="Every inbound & outbound call, recordings, transcripts, and voicemail."
        meta={
          <>
            <HeaderStat label="Calls" value={calls.data?.length ?? 0} />
            <HeaderStat label="Unread voicemail" value={unread} />
          </>
        }
      />
      <PageBody>
        <Tabs defaultValue="calls">
          <TabsList>
            <TabsTrigger value="calls">History ({calls.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="voicemail">
              Voicemail {unread > 0 && <Badge className="ml-2" variant="destructive">{unread}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calls" className="mt-4">
            <div className="overflow-x-auto">
              <DataTable
                tableKey="calls"
                caption="Call history"
                rows={(calls.data ?? []) as CallRow[]}
                columns={columns}
                rowKey={(c) => c.id}
                isLoading={calls.isLoading}
                error={calls.error}
                onRetry={() => calls.refetch()}
                emptyTitle="No calls yet"
                emptyDescription="Use the softphone in the bottom-right corner to place your first call."
              />
            </div>
          </TabsContent>

          <TabsContent value="voicemail" className="mt-4 space-y-3">
            {vms.isLoading ? (
              <ListSkeleton />
            ) : vms.error ? (
              <ErrorState error={vms.error} onRetry={() => vms.refetch()} />
            ) : (vms.data ?? []).length === 0 ? (
              <EmptyState
                icon={Voicemail}
                title="No voicemails"
                description="Missed calls that leave a voicemail will show up here."
              />
            ) : (
              (vms.data ?? []).map((v: any) => (
                <div
                  key={v.id}
                  className={`border border-border rounded-lg p-4 ${v.listened_at ? "opacity-60" : "bg-accent/40"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Voicemail className="size-4 shrink-0" />
                        <span className="truncate font-mono text-sm">{v.from_number}</span>
                        {!v.listened_at && <Badge variant="destructive" className="text-xs">New</Badge>}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()} · {v.duration_seconds ?? 0}s
                        </span>
                      </div>
                      {v.transcription && (
                        <p className="mt-2 text-sm italic text-muted-foreground">"{v.transcription}"</p>
                      )}
                      {v.transcription_status === "in-progress" && (
                        <p className="mt-1 text-xs text-muted-foreground">Transcription pending…</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <audio
                          controls
                          src={v.recording_url}
                          className="h-8 max-w-full"
                          onPlay={() => !v.listened_at && markMut.mutate(v.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
