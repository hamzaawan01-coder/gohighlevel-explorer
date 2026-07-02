import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Phone, PhoneIncoming, PhoneOutgoing, Voicemail, PlayCircle } from "lucide-react";
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

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Phone className="h-6 w-6" /> Calls</h1>
            <p className="text-sm text-muted-foreground">Every inbound & outbound call, recordings, transcripts, and voicemail.</p>
          </div>
        </header>

        <Tabs defaultValue="calls">
          <TabsList>
            <TabsTrigger value="calls">History ({calls.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="voicemail">
              Voicemail {unread > 0 && <Badge className="ml-2" variant="destructive">{unread}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calls" className="mt-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Recording</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(calls.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {c.direction === "inbound" ? (
                          <PhoneIncoming className="h-4 w-4 text-green-600" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.from_number}</TableCell>
                      <TableCell className="font-mono text-xs">{c.to_number}</TableCell>
                      <TableCell><Badge variant="outline">{c.status ?? "—"}</Badge></TableCell>
                      <TableCell>{c.duration_seconds ? `${c.duration_seconds}s` : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {c.started_at ? new Date(c.started_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {c.recording_url ? (
                          <audio controls src={c.recording_url} className="h-8" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!calls.data?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No calls yet. Use the softphone in the bottom-right to make one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="voicemail" className="mt-4 space-y-3">
            {(vms.data ?? []).map((v: any) => (
              <div key={v.id} className={`border border-border rounded-lg p-4 ${v.listened_at ? "opacity-60" : "bg-accent/40"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Voicemail className="h-4 w-4" />
                      <span className="font-mono text-sm">{v.from_number}</span>
                      {!v.listened_at && <Badge variant="destructive" className="text-xs">New</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(v.created_at).toLocaleString()} · {v.duration_seconds ?? 0}s
                      </span>
                    </div>
                    {v.transcription && (
                      <p className="text-sm mt-2 italic text-muted-foreground">"{v.transcription}"</p>
                    )}
                    {v.transcription_status === "in-progress" && (
                      <p className="text-xs text-muted-foreground mt-1">Transcription pending…</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <audio controls src={v.recording_url} className="h-8" onPlay={() => !v.listened_at && markMut.mutate(v.id)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!vms.data?.length && (
              <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
                <Voicemail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No voicemails.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
