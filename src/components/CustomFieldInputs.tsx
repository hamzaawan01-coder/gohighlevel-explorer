import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDef, CustomFieldValues } from "@/lib/custom-fields";

/** Renders the custom fields defined in settings for one entity. */
export function CustomFieldInputs({
  defs,
  values,
  onChange,
}: {
  defs: CustomFieldDef[];
  values: CustomFieldValues;
  onChange: (key: string, value: string | number | boolean | null) => void;
}) {
  if (defs.length === 0) return null;
  return (
    <div className="space-y-4">
      {defs.map((d) => {
        const raw = values[d.key];
        const id = `dcf_${d.key}`;
        return (
          <div key={d.id} className="space-y-2">
            <Label htmlFor={id}>
              {d.label}
              {d.required && <span className="text-destructive"> *</span>}
            </Label>
            {d.field_type === "textarea" ? (
              <Textarea
                id={id}
                rows={2}
                required={d.required}
                value={raw == null ? "" : String(raw)}
                onChange={(e) => onChange(d.key, e.target.value)}
              />
            ) : d.field_type === "select" ? (
              <Select
                value={raw == null || raw === "" ? undefined : String(raw)}
                onValueChange={(v) => onChange(d.key, v)}
              >
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {d.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : d.field_type === "checkbox" ? (
              <div className="flex items-center gap-2">
                <Switch checked={!!raw} onCheckedChange={(v) => onChange(d.key, v)} />
                <span className="text-xs text-muted-foreground">{raw ? "Yes" : "No"}</span>
              </div>
            ) : (
              <Input
                id={id}
                type={
                  d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"
                }
                required={d.required}
                value={raw == null ? "" : String(raw)}
                onChange={(e) =>
                  onChange(
                    d.key,
                    d.field_type === "number"
                      ? e.target.value === ""
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
