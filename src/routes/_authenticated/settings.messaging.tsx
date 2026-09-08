import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleStat, ConsoleTips, StatusPill } from "@/components/console";
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
import { PanelSkeleton } from "@/components/ui/states";
import { ErrorState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/settings/messaging")({
  head: () => ({
    meta: [
      { title: "Quiet hours — Settings" },
      {
        name: "description",
        content:
          "Hold workflow SMS and email overnight and release them at the end of the quiet-hours window.",
      },
    ],
  }),
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
    <AppShell>
      <PageHeader
        title="Quiet hours"
        description="Don't text or email your contacts overnight. Any workflow message that would fire during quiet hours is held and sent at the end of the window instead."
        crumbs={[{ label: "Settings" }, { label: "Quiet hours" }]}
        meta={
          row ? (
            <StatusPill ok={row.quiet_hours_enabled} label={row.quiet_hours_enabled ? "Enabled" : "Disabled"} />
          ) : null
        }
        actions={
          row ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null
        }
      />
      <PageBody width="full">
        <SettingsShell>
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} error={q.error} />
        ) : !row ? (
          <PanelSkeleton />
        ) : (
          <ConsoleSplit
            main={
              <ConsoleSection title="Quiet hours window" icon={Moon} hint={row.quiet_hours_timezone}>
                <div className="space-y-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Enable quiet hours</p>
                      <p className="text-[11px] text-muted-foreground">
                        When off, workflow messages send immediately, any time of day.
                      </p>
                    </div>
                    <Switch
                      aria-label="Enable quiet hours"
                      checked={row.quiet_hours_enabled}
                      onCheckedChange={(v) => setRow({ ...row, quiet_hours_enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="qh-start" className="text-xs">Start</Label>
                      <Select
                        value={String(row.quiet_hours_start)}
                        onValueChange={(v) => setRow({ ...row, quiet_hours_start: Number(v) })}
                      >
                        <SelectTrigger id="qh-start"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qh-end" className="text-xs">End</Label>
                      <Select
                        value={String(row.quiet_hours_end)}
                        onValueChange={(v) => setRow({ ...row, quiet_hours_end: Number(v) })}
                      >
                        <SelectTrigger id="qh-end"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="qh-tz" className="text-xs">Time zone</Label>
                    <Select
                      value={row.quiet_hours_timezone}
                      onValueChange={(v) => setRow({ ...row, quiet_hours_timezone: v })}
                    >
                      <SelectTrigger id="qh-tz"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ConsoleSection>
            }
            side={
              <>
                <ConsoleSection title="Preview">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {row.quiet_hours_enabled ? (
                      <>
                        Messages triggered between <b className="text-foreground">{fmtHour(row.quiet_hours_start)}</b> and{" "}
                        <b className="text-foreground">{fmtHour(row.quiet_hours_end)}</b> ({row.quiet_hours_timezone}) will
                        hold and send at <b className="text-foreground">{fmtHour(row.quiet_hours_end)}</b>.
                      </>
                    ) : (
                      "Quiet hours are off. All workflow messages send right away."
                    )}
                  </p>
                  <div className="mt-3">
                    <ConsoleStat
                      label="Status"
                      value={row.quiet_hours_enabled ? "Enabled" : "Disabled"}
                      tone={row.quiet_hours_enabled ? "ok" : "muted"}
                    />
                    <ConsoleStat label="Time zone" value={row.quiet_hours_timezone} />
                  </div>
                </ConsoleSection>
                <ConsoleTips
                  items={[
                    "Quiet hours apply to workflow-triggered SMS and email, not manual sends from the inbox.",
                    "Held messages release automatically at the end of the window in the selected time zone.",
                    "Changing the time zone doesn't resend anything already delivered.",
                  ]}
                />
              </>
            }
          />
        )}
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
