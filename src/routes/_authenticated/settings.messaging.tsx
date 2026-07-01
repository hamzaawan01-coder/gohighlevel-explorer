import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/messaging")({
  head: () => ({ meta: [{ title: "Quiet hours — Settings" }] }),
  component: MessagingSettingsPage,
});

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Halifax",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type Row = {
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  quiet_hours_timezone: string;
};

function fmtHour(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

function MessagingSettingsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["sub-account-quiet-hours", subId],
    enabled: !!subId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_accounts")
        .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone")
        .eq("id", subId!)
        .single();
      if (error) throw error;
      return data as Row;
    },
  });

  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    if (q.data) setRow(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!subId || !row) return;
      const { error } = await supabase
        .from("sub_accounts")
        .update({
          quiet_hours_enabled: row.quiet_hours_enabled,
          quiet_hours_start: row.quiet_hours_start,
          quiet_hours_end: row.quiet_hours_end,
          quiet_hours_timezone: row.quiet_hours_timezone,
        })
        .eq("id", subId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-account-quiet-hours", subId] });
      toast.success("Quiet hours saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Moon className="size-3.5" />
          <span className="text-foreground font-medium">Quiet hours</span>
        </div>
      }
    >
      <div className="p-6 space-y-6 overflow-auto h-full max-w-2xl">
        <div>
          <h1 className="text-lg font-bold">Quiet hours</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Don't text or email your contacts overnight. Any workflow message that would
            fire during quiet hours is held and sent at the end of the window instead.
          </p>
        </div>

        {!row ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Enable quiet hours</p>
                <p className="text-[11px] text-muted-foreground">
                  When off, workflow messages send immediately, any time of day.
                </p>
              </div>
              <Switch
                checked={row.quiet_hours_enabled}
                onCheckedChange={(v) => setRow({ ...row, quiet_hours_enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Select
                  value={String(row.quiet_hours_start)}
                  onValueChange={(v) => setRow({ ...row, quiet_hours_start: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Select
                  value={String(row.quiet_hours_end)}
                  onValueChange={(v) => setRow({ ...row, quiet_hours_end: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Time zone</Label>
              <Select
                value={row.quiet_hours_timezone}
                onValueChange={(v) => setRow({ ...row, quiet_hours_timezone: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground">
              Preview: {row.quiet_hours_enabled ? (
                <>
                  Messages triggered between <b>{fmtHour(row.quiet_hours_start)}</b> and{" "}
                  <b>{fmtHour(row.quiet_hours_end)}</b> ({row.quiet_hours_timezone}) will
                  hold and send at <b>{fmtHour(row.quiet_hours_end)}</b>.
                </>
              ) : (
                "Quiet hours are off. All workflow messages send right away."
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
