import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaLeadSource } from "@/lib/meta.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Facebook, Download, Paperclip, ChevronDown, ChevronRight } from "lucide-react";

const FILE_RE = /^https?:\/\/\S+$/i;
const FILE_EXT_RE = /\.(pdf|png|jpe?g|gif|webp|heic|docx?|xlsx?|csv|txt|zip)(\?|$)/i;

function prettyLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function isAttachment(value: string) {
  return FILE_RE.test(value) && (FILE_EXT_RE.test(value) || /attachment|upload|file/i.test(value));
}

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<[string, string]>) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return ["Field,Value", ...rows.map(([k, v]) => `${esc(k)},${esc(v)}`)].join("\n");
}

/**
 * Shows the Meta origin of a contact or opportunity: which Facebook Page and
 * Lead Ad form it came from, the full set of submitted answers (including
 * custom labels and uploaded files), the raw payload Meta sent, and an export.
 */
export function MetaLeadSourcePanel({
  subId,
  contactId,
  dealId,
}: {
  subId: string;
  contactId?: string | null;
  dealId?: string | null;
}) {
  const fn = useServerFn(getMetaLeadSource);
  const { data, isLoading } = useQuery({
    queryKey: ["meta-lead-source", subId, contactId ?? null, dealId ?? null],
    queryFn: () =>
      fn({ data: { subAccountId: subId, contactId: contactId ?? null, dealId: dealId ?? null } }),
    enabled: Boolean(subId && (contactId || dealId)),
  });

  const events = data?.events ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? events[0] ?? null,
    [events, selectedId],
  );

  if (isLoading || events.length === 0 || !selected) return null;

  const contact = data?.contact ?? null;
  const fields = (selected.lead_fields ?? data?.leadFields ?? {}) as Record<string, string>;
  const entries = Object.entries(fields);
  const attachments = entries.filter(([, v]) => typeof v === "string" && isAttachment(v));
  const answers = entries.filter(([, v]) => !(typeof v === "string" && isAttachment(v)));

  const contactRows: Array<[string, string]> = contact
    ? [
        ["First name", contact.first_name ?? "—"],
        ["Last name", contact.last_name ?? "—"],
        ["Email", contact.email ?? "—"],
        ["Phone", contact.phone ?? "—"],
        ["Company", contact.company ?? "—"],
        ["Lifecycle stage", contact.lifecycle_stage ?? "—"],
        ["Lead source", contact.lead_source ?? "—"],
        ["Tags", (contact.tags ?? []).join(", ") || "—"],
        ["Notes", contact.notes ?? "—"],
        ["Created", new Date(contact.created_at).toLocaleString()],
      ]
    : [];

  const metaRows: Array<[string, string]> = [
    ["Facebook Page", data?.page?.page_name ?? selected.page_id ?? "—"],
    ["Page ID", selected.page_id ?? "—"],
    ["Lead Ad form", selected.form_name ?? selected.form_id ?? "—"],
    ["Form ID", selected.form_id ?? "—"],
    ["Pipeline", data?.pipelineName ?? "—"],
    ["Stage", data?.stageName ?? "—"],
    ["Routing", selected.routing_source === "mapped" ? "Custom form mapping" : "Default pipeline"],
    ["Meta lead ID", selected.leadgen_id ?? "—"],
    ["Webhook event ID", selected.id],
    ["Status", selected.status],
    ["Test lead", selected.is_test ? "yes" : "no"],
    ["Received", new Date(selected.created_at).toLocaleString()],
  ];

  const exportRows: Array<[string, string]> = [
    ...contactRows.map(([k, v]) => [`Contact · ${k}`, v] as [string, string]),
    ...entries.map(([k, v]) => [`Answer · ${prettyLabel(k)}`, String(v)] as [string, string]),
    ...metaRows.map(([k, v]) => [`Meta · ${k}`, v] as [string, string]),
  ];

  const baseName = `lead-${selected.leadgen_id ?? selected.id}`;

  const exportJson = () =>
    download(
      `${baseName}.json`,
      "application/json",
      JSON.stringify(
        {
          contact,
          answers: fields,
          attachments: attachments.map(([k, v]) => ({ field: k, url: v })),
          meta: Object.fromEntries(metaRows),
          rawPayload: selected.payloadJson ? JSON.parse(selected.payloadJson) : null,
        },
        null,
        2,
      ),
    );

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
        <Facebook className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-medium">Lead source</h4>
        {selected.is_test && <Badge variant="outline">test</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={exportJson}>
            <Download className="size-3 mr-1" /> JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => download(`${baseName}.csv`, "text/csv", toCsv(exportRows))}
          >
            <Download className="size-3 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {events.length > 1 && (
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Lead
          </span>
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id} className="text-xs">
                  {(ev.form_name ?? ev.form_id ?? "Lead")} ·{" "}
                  {new Date(ev.created_at).toLocaleString()} · {ev.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <dl className="divide-y divide-border">
        {metaRows.map(([k, v]) => (
          <div key={k} className="px-4 py-2.5 grid grid-cols-[130px_1fr] gap-4 text-xs">
            <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground self-center">
              {k}
            </dt>
            <dd className="min-w-0 break-all">{v}</dd>
          </div>
        ))}
      </dl>

      {contactRows.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Contact details
          </div>
          <dl className="divide-y divide-border">
            {contactRows.map(([k, v]) => (
              <div key={k} className="px-4 py-2.5 grid grid-cols-[130px_1fr] gap-4 text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {answers.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Form answers · {answers.length}
          </div>
          <dl className="divide-y divide-border">
            {answers.map(([k, v]) => (
              <div key={k} className="px-4 py-2.5 grid grid-cols-[160px_1fr] gap-4 text-xs">
                <dt className="text-muted-foreground break-words">{prettyLabel(k)}</dt>
                <dd className="min-w-0 break-words text-foreground">{String(v) || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Attachments · {attachments.length}
          </div>
          <ul className="divide-y divide-border">
            {attachments.map(([k, v]) => (
              <li key={k} className="px-4 py-2.5 text-xs flex items-center gap-2">
                <Paperclip className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">{prettyLabel(k)}</span>
                <a
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline truncate ml-auto"
                >
                  Open file
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setRawOpen((o) => !o)}
          className="w-full px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {rawOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          View raw Meta fields
        </button>
        {rawOpen && (
          <div className="px-4 pb-3 space-y-2">
            <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(fields, null, 2)}
            </pre>
            {selected.payloadJson && (
              <>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Raw webhook payload
                </div>
                <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
                  {selected.payloadJson}
                </pre>
              </>
            )}
          </div>
        )}
      </div>

      <details className="px-4 py-2.5 border-t border-border">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">
          Webhook events · {events.length}
        </summary>
        <ul className="mt-2 space-y-1.5">
          {events.map((ev) => (
            <li key={ev.id} className="text-[11px] flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] break-all">{ev.id}</span>
              <Badge
                variant={
                  ev.status === "ok" ? "secondary" : ev.status === "error" ? "destructive" : "outline"
                }
              >
                {ev.status}
              </Badge>
              <span className="text-muted-foreground ml-auto">
                {new Date(ev.created_at).toLocaleString()}
              </span>
              {ev.error && <span className="text-destructive w-full">{ev.error}</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
