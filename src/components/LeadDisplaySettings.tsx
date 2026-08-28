import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLeadDisplayPrefs } from "@/lib/lead-display-prefs";

/** Controls which sensitive sections of the lead modal are visible. */
export function LeadDisplaySettings() {
  const { prefs, update } = useLeadDisplayPrefs();

  return (
    <div className="rounded-md border border-border">
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-sm font-medium">Lead modal display</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          These sections are hidden by default. Turn them on to show them inside contact and
          opportunity lead panels.
        </p>
      </div>
      <div className="divide-y divide-border">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <Label htmlFor="pref-lead-source" className="text-xs font-normal">
            Show lead source details (Page, form, routing, IDs)
          </Label>
          <Switch
            id="pref-lead-source"
            checked={prefs.showLeadSource}
            onCheckedChange={(v) => update({ showLeadSource: v })}
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <Label htmlFor="pref-raw-payload" className="text-xs font-normal">
            Show raw Meta fields and raw webhook payload
          </Label>
          <Switch
            id="pref-raw-payload"
            checked={prefs.showRawPayload}
            onCheckedChange={(v) => update({ showRawPayload: v })}
          />
        </div>
      </div>
    </div>
  );
}
