import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaLeadSource } from "@/lib/meta.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadDisplayPrefs } from "@/lib/lead-display-prefs";
import {
  useSavedLeadSearches,
  readLeadFilterState,
  writeLeadFilterState,
  clearLeadFilterState,
} from "@/lib/lead-saved-searches";
import { CopyField } from "@/components/CopyField";
import {
  dedupeValues,
  isEmailKey,
  isPhoneKey,
  normalizeEmail,
  normalizePhone,
} from "@/lib/lead-normalize";
import {
  Facebook,
  Download,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Search,
  AlertTriangle,
  Clock,
  EyeOff,
  Save,
  Trash2,
  ListChecks,
  RotateCcw,
  Loader2,

} from "lucide-react";

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

const EXPECTED_CONTACT_FIELDS = [
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Company",
  "Lead source",
] as const;

const EXPECTED_ANSWER_KEYS = ["full_name", "email", "phone_number"] as const;

type ColumnKey = "contact" | "answers" | "attachments" | "metadata" | "raw";

const COLUMN_LABELS: Array<{ key: ColumnKey; label: string }> = [
  { key: "contact", label: "Contact info" },
  { key: "answers", label: "Answers" },
  { key: "attachments", label: "Attachments" },
  { key: "metadata", label: "Metadata" },
  { key: "raw", label: "Raw payload" },
];

type TimelineKind = "meta" | "crm" | "webhook_ok" | "webhook_error";

const TIMELINE_KINDS: Array<{ key: TimelineKind; label: string }> = [
  { key: "meta", label: "Meta lifecycle" },
  { key: "crm", label: "CRM events" },
  { key: "webhook_ok", label: "Webhooks · ok" },
  { key: "webhook_error", label: "Webhooks · failed" },
];

const COLUMN_KEYS = COLUMN_LABELS.map((c) => c.key);

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  contact: true,
  answers: true,
  attachments: true,
  metadata: true,
  raw: false,
};

const DEFAULT_TIMELINE_KINDS: TimelineKind[] = TIMELINE_KINDS.map((k) => k.key);

/** Collects date-ish values from raw Meta fields for the timeline. */
function timelineFromFields(fields: Record<string, string>) {
  const out: Array<{ label: string; at: Date; kind: TimelineKind }> = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string") continue;
    if (!/time|date|_at$|created|updated|submitted/i.test(k)) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) out.push({ label: prettyLabel(k), at: d, kind: "meta" });
  }
  return out;
}

/**
 * Shows the Meta origin of a contact or opportunity: which Facebook Page and
 * Lead Ad form it came from, the full set of submitted answers (including
 * custom labels and uploaded files), a searchable index, missing-field flags,
 * a lifecycle timeline, and configurable exports.
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

  const { prefs } = useLeadDisplayPrefs();
  const events = data?.events ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [csvOpen, setCsvOpen] = useState(false);
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [timelineKinds, setTimelineKinds] = useState<TimelineKind[]>(DEFAULT_TIMELINE_KINDS);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [searchName, setSearchName] = useState("");
  const [busy, setBusy] = useState<null | "json" | "csv" | "bulk-csv" | "bulk-json" | "save">(null);
  const [hydrated, setHydrated] = useState(false);
  const { searches, save: saveSearch, remove: removeSearch } = useSavedLeadSearches();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Restore the last-used filter state so searches survive refreshes and sessions.
  useEffect(() => {
    const saved = readLeadFilterState();
    if (saved) {
      setDraftQuery(saved.query);
      setQuery(saved.query);
      setColumns((c) => ({ ...c, ...(saved.columns as Record<ColumnKey, boolean>) }));
      if (saved.timelineKinds.length) setTimelineKinds(saved.timelineKinds as TimelineKind[]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLeadFilterState({ query, columns, timelineKinds });
  }, [hydrated, query, columns, timelineKinds]);

  // Debounced live search; Enter applies immediately.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(draftQuery), 300);
    return () => window.clearTimeout(t);
  }, [draftQuery]);

  const isDefaultFilters =
    query.trim() === "" &&
    draftQuery.trim() === "" &&
    COLUMN_KEYS.every((k) => columns[k] === DEFAULT_COLUMNS[k]) &&
    timelineKinds.length === DEFAULT_TIMELINE_KINDS.length;

  const resetFilters = useCallback(() => {
    setDraftQuery("");
    setQuery("");
    setColumns(DEFAULT_COLUMNS);
    setTimelineKinds(DEFAULT_TIMELINE_KINDS);
    setSearchName("");
    setBulkIds([]);
    clearLeadFilterState();
  }, []);

  // Keyboard shortcuts: "/" focuses search, Esc clears the search or closes panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        const inside = !!rootRef.current && !!target && rootRef.current.contains(target);
        if (!inside) return;
        e.preventDefault();
        if (draftQuery || query) {
          setDraftQuery("");
          setQuery("");
        } else if (csvOpen || bulkOpen || rawOpen || sourceOpen) {
          setCsvOpen(false);
          setBulkOpen(false);
          setRawOpen(false);
          setSourceOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draftQuery, query, csvOpen, bulkOpen, rawOpen, sourceOpen]);

  const runBusy = useCallback(
    async (kind: "json" | "csv" | "bulk-csv" | "bulk-json" | "save", action: () => void) => {
      setBusy(kind);
      try {
        action();
        await new Promise((r) => window.setTimeout(r, 250));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

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

  // Normalized + deduped phone/email across contact record and all lead answers.
  const phoneCandidates = [
    contact?.phone ?? null,
    ...entries.filter(([k]) => isPhoneKey(k)).map(([, v]) => String(v)),
  ];
  const emailCandidates = [
    contact?.email ?? null,
    ...entries.filter(([k]) => isEmailKey(k)).map(([, v]) => String(v)),
  ];
  const phones = dedupeValues(phoneCandidates, normalizePhone);
  const emails = dedupeValues(emailCandidates, normalizeEmail);

  const contactRows: Array<[string, string]> = contact
    ? [
        ["First name", contact.first_name ?? "—"],
        ["Last name", contact.last_name ?? "—"],
        ["Email", emails.map((e) => e.normalized).join(", ") || "—"],
        ["Phone", phones.map((p) => p.normalized).join(", ") || "—"],
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

  // Missing-field detection
  const missingContact = contact
    ? EXPECTED_CONTACT_FIELDS.filter((label) => {
        const row = contactRows.find(([k]) => k === label);
        return !row || row[1] === "—" || row[1].trim() === "";
      })
    : ["Contact record"];
  const missingAnswers = EXPECTED_ANSWER_KEYS.filter((k) => {
    const match = entries.find(([key]) => key.toLowerCase().includes(k));
    return !match || String(match[1] ?? "").trim() === "";
  }).map(prettyLabel);
  const emptyAnswers = answers
    .filter(([, v]) => String(v ?? "").trim() === "")
    .map(([k]) => prettyLabel(k));
  const missing = [...missingContact, ...missingAnswers, ...emptyAnswers];

  // Timeline
  const allTimeline: Array<{ label: string; at: Date; kind: TimelineKind }> = [
    ...timelineFromFields(fields),
    ...(contact
      ? [
          {
            label: "Contact created in CRM",
            at: new Date(contact.created_at),
            kind: "crm" as TimelineKind,
          },
        ]
      : []),
    ...events.map((ev) => ({
      label: `Webhook ${ev.status}${ev.form_name ? ` · ${ev.form_name}` : ""}`,
      at: new Date(ev.created_at),
      kind: (ev.status === "error" ? "webhook_error" : "webhook_ok") as TimelineKind,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const timeline = allTimeline.filter((t) => timelineKinds.includes(t.kind));

  // Search index
  const q = query.trim().toLowerCase();
  const searchRows: Array<[string, string, string]> = [
    ...contactRows.map(([k, v]) => ["Contact", k, v] as [string, string, string]),
    ...entries.map(([k, v]) => ["Answer", prettyLabel(k), String(v)] as [string, string, string]),
    ...metaRows.map(([k, v]) => ["Meta", k, v] as [string, string, string]),
  ];
  const searchResults = q
    ? searchRows.filter(
        ([group, k, v]) =>
          k.toLowerCase().includes(q) ||
          String(v).toLowerCase().includes(q) ||
          group.toLowerCase().includes(q),
      )
    : [];

  const eventRows = (
    ev: (typeof events)[number],
    cols: Record<ColumnKey, boolean>,
  ): Array<[string, string]> => {
    const evFields = (ev.lead_fields ?? {}) as Record<string, string>;
    const evEntries = Object.entries(evFields);
    const evAttachments = evEntries.filter(([, v]) => typeof v === "string" && isAttachment(v));
    const evAnswers = evEntries.filter(([, v]) => !(typeof v === "string" && isAttachment(v)));
    const evMeta: Array<[string, string]> = [
      ["Facebook Page", ev.page_id ?? "—"],
      ["Lead Ad form", ev.form_name ?? ev.form_id ?? "—"],
      ["Form ID", ev.form_id ?? "—"],
      ["Meta lead ID", ev.leadgen_id ?? "—"],
      ["Webhook event ID", ev.id],
      ["Status", ev.status],
      ["Test lead", ev.is_test ? "yes" : "no"],
      ["Received", new Date(ev.created_at).toLocaleString()],
    ];
    return [
      ...(cols.contact ? contactRows.map(([k, v]) => [`Contact · ${k}`, v] as [string, string]) : []),
      ...(cols.answers
        ? evAnswers.map(([k, v]) => [`Answer · ${prettyLabel(k)}`, String(v)] as [string, string])
        : []),
      ...(cols.attachments
        ? evAttachments.map(
            ([k, v]) => [`Attachment · ${prettyLabel(k)}`, String(v)] as [string, string],
          )
        : []),
      ...(cols.metadata ? evMeta : []),
      ...(cols.raw ? [["Raw payload", ev.payloadJson ?? ""] as [string, string]] : []),
    ];
  };

  const exportRows = (cols: Record<ColumnKey, boolean>): Array<[string, string]> => [
    ...(cols.contact
      ? contactRows.map(([k, v]) => [`Contact · ${k}`, v] as [string, string])
      : []),
    ...(cols.answers
      ? answers.map(([k, v]) => [`Answer · ${prettyLabel(k)}`, String(v)] as [string, string])
      : []),
    ...(cols.attachments
      ? attachments.map(([k, v]) => [`Attachment · ${prettyLabel(k)}`, String(v)] as [string, string])
      : []),
    ...(cols.metadata ? metaRows.map(([k, v]) => [`Meta · ${k}`, v] as [string, string]) : []),
    ...(cols.raw ? [["Raw payload", selected.payloadJson ?? ""] as [string, string]] : []),
  ];

  const baseName = `lead-${selected.leadgen_id ?? selected.id}`;

  const exportJson = () =>
    download(
      `${baseName}.json`,
      "application/json",
      JSON.stringify(
        {
          contact,
          normalized: { emails: emails.map((e) => e.normalized), phones: phones.map((p) => p.normalized) },
          answers: fields,
          attachments: attachments.map(([k, v]) => ({ field: k, url: v })),
          meta: Object.fromEntries(metaRows),
          timeline: timeline.map((t) => ({ label: t.label, at: t.at.toISOString() })),
          rawPayload: selected.payloadJson ? JSON.parse(selected.payloadJson) : null,
        },
        null,
        2,
      ),
    );

  const bulkSelected = events.filter((ev) => bulkIds.includes(ev.id));

  const exportBulkCsv = () => {
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["Lead,Field,Value"];
    for (const ev of bulkSelected) {
      const name = ev.leadgen_id ?? ev.id;
      for (const [k, v] of eventRows(ev, columns)) lines.push(`${esc(name)},${esc(k)},${esc(v)}`);
    }
    download(`leads-${bulkSelected.length}.csv`, "text/csv", lines.join("\n"));
  };

  const exportBulkJson = () =>
    download(
      `leads-${bulkSelected.length}.json`,
      "application/json",
      JSON.stringify(
        bulkSelected.map((ev) => ({
          leadId: ev.leadgen_id ?? ev.id,
          fields: Object.fromEntries(eventRows(ev, columns)),
        })),
        null,
        2,
      ),
    );

  const anyColumn = Object.values(columns).some(Boolean);

  return (
    <div ref={rootRef} className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
        <Facebook className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-medium">Lead source</h4>
        {selected.is_test && <Badge variant="outline">test</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            disabled={isDefaultFilters || busy !== null}
            title="Reset search, timeline filters and export columns"
            onClick={resetFilters}
          >
            <RotateCcw className="size-3 mr-1" /> Reset filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={busy !== null}
            onClick={() => runBusy("json", exportJson)}
          >
            {busy === "json" ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Download className="size-3 mr-1" />
            )}{" "}
            JSON
          </Button>
          <Button
            size="sm"
            variant={csvOpen ? "secondary" : "outline"}
            className="h-7 px-2 text-[11px]"
            aria-expanded={csvOpen}
            disabled={busy !== null}
            onClick={() => setCsvOpen((o) => !o)}
          >
            <Download className="size-3 mr-1" /> CSV
          </Button>
          {events.length > 1 && (
            <Button
              size="sm"
              variant={bulkOpen ? "secondary" : "outline"}
              className="h-7 px-2 text-[11px]"
              aria-expanded={bulkOpen}
              disabled={busy !== null}
              onClick={() => setBulkOpen((o) => !o)}
            >
              <ListChecks className="size-3 mr-1" /> Bulk
            </Button>
          )}
        </div>
      </div>

      {csvOpen && (
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Choose columns to export
          </div>
          <div className="flex flex-wrap gap-3">
            {COLUMN_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={columns[key]}
                  disabled={busy !== null}
                  onCheckedChange={(v) => setColumns((c) => ({ ...c, [key]: Boolean(v) }))}
                />
                {label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={!anyColumn || busy !== null}
            onClick={() =>
              runBusy("csv", () => {
                download(`${baseName}.csv`, "text/csv", toCsv(exportRows(columns)));
                setCsvOpen(false);
              })
            }
          >
            {busy === "csv" && <Loader2 className="size-3 mr-1 animate-spin" />}
            Download CSV
          </Button>
        </div>
      )}

      {bulkOpen && events.length > 1 && (
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Select leads to export · {bulkIds.length}/{events.length}
            </div>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={busy !== null || bulkIds.length === events.length}
                onClick={() => setBulkIds(events.map((e) => e.id))}
              >
                All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={busy !== null || bulkIds.length === 0}
                onClick={() => setBulkIds([])}
              >
                None
              </Button>
            </div>
          </div>
          <div className="max-h-48 overflow-auto rounded border border-border divide-y divide-border">
            {events.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <Checkbox
                  checked={bulkIds.includes(ev.id)}
                  disabled={busy !== null}
                  onCheckedChange={(v) =>
                    setBulkIds((ids) =>
                      v ? [...new Set([...ids, ev.id])] : ids.filter((i) => i !== ev.id),
                    )
                  }
                />
                <span className="min-w-0 truncate">
                  {ev.form_name ?? ev.form_id ?? "Lead"} · {ev.leadgen_id ?? ev.id}
                </span>
                <span className="ml-auto text-muted-foreground shrink-0">
                  {new Date(ev.created_at).toLocaleDateString()}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Uses the same columns as the CSV picker above.
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={bulkIds.length === 0 || !anyColumn || busy !== null}
              onClick={() => runBusy("bulk-csv", exportBulkCsv)}
            >
              {busy === "bulk-csv" ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Download className="size-3 mr-1" />
              )}{" "}
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={bulkIds.length === 0 || !anyColumn || busy !== null}
              onClick={() => runBusy("bulk-json", exportBulkJson)}
            >
              {busy === "bulk-json" ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Download className="size-3 mr-1" />
              )}{" "}
              Export JSON
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 border-b border-border">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setQuery(draftQuery);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                if (draftQuery || query) {
                  setDraftQuery("");
                  setQuery("");
                } else {
                  searchRef.current?.blur();
                }
              }
            }}
            placeholder="Search any field, custom label or answer…  ( / to focus, Enter to apply, Esc to clear )"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchName.trim() && draftQuery.trim()) {
                e.preventDefault();
                setQuery(draftQuery);
                void runBusy("save", () => {
                  saveSearch({
                    name: searchName.trim(),
                    query: draftQuery,
                    columns,
                    timelineKinds,
                  });
                  setSearchName("");
                });
              }
            }}
            placeholder="Name this filter to save it…"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] shrink-0"
            disabled={!searchName.trim() || !draftQuery.trim() || busy !== null}
            onClick={() =>
              runBusy("save", () => {
                setQuery(draftQuery);
                saveSearch({
                  name: searchName.trim(),
                  query: draftQuery,
                  columns,
                  timelineKinds,
                });
                setSearchName("");
              })
            }
          >
            {busy === "save" ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Save className="size-3 mr-1" />
            )}{" "}
            Save
          </Button>
        </div>

        {searches.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {searches.map((s) => {
              const active =
                s.query === query &&
                (s.timelineKinds?.length ? s.timelineKinds : DEFAULT_TIMELINE_KINDS).every((k) =>
                  timelineKinds.includes(k as TimelineKind),
                );
              return (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1 rounded-full border pl-2 pr-1 py-0.5 text-[11px] ${
                    active ? "border-accent text-accent" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    className="hover:text-accent disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => {
                      setDraftQuery(s.query);
                      setQuery(s.query);
                      setColumns((c) => ({ ...c, ...(s.columns as Record<ColumnKey, boolean>) }));
                      setTimelineKinds(
                        (s.timelineKinds as TimelineKind[] | undefined)?.length
                          ? (s.timelineKinds as TimelineKind[])
                          : DEFAULT_TIMELINE_KINDS,
                      );
                    }}
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete saved filter ${s.name}`}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => removeSearch(s.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {q && (
          <div className="mt-2 rounded border border-border divide-y divide-border max-h-60 overflow-auto">
            {searchResults.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
            ) : (
              searchResults.map(([group, k, v], i) => (
                <div key={`${group}-${k}-${i}`} className="px-3 py-2 text-xs flex gap-2">
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {group}
                  </Badge>
                  <span className="text-muted-foreground shrink-0">{k}</span>
                  <span className="ml-auto min-w-0 break-words text-right">{v || "—"}</span>
                  <CopyField value={v} label={k} />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border flex items-start gap-2 text-xs">
          <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium">Missing fields · {missing.length}</div>
            <div className="text-muted-foreground break-words">{missing.join(", ")}</div>
          </div>
        </div>
      )}

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

      {prefs.showLeadSource ? (
        <>
          <button
            type="button"
            onClick={() => setSourceOpen((o) => !o)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground border-b border-border"
          >
            {sourceOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {sourceOpen ? "Hide lead source details" : "Show lead source details"}
          </button>
          {sourceOpen && (
            <dl className="divide-y divide-border">
              {metaRows.map(([k, v]) => (
                <div key={k} className="px-4 py-2.5 grid grid-cols-[130px_1fr_auto] gap-3 text-xs">
                  <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground self-center">
                    {k}
                  </dt>
                  <dd className="min-w-0 break-all">{v}</dd>
                  <CopyField value={v} label={k} />
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
          <EyeOff className="size-3" />
          Lead source details are hidden — enable them in Settings → Integrations → Meta.
        </div>
      )}

      {contactRows.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Contact details
          </div>
          <dl className="divide-y divide-border">
            {contactRows.map(([k, v]) => (
              <div key={k} className="px-4 py-2.5 grid grid-cols-[130px_1fr_auto] gap-3 text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words text-foreground">{v}</dd>
                <CopyField value={v} label={k} />
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
              <div key={k} className="px-4 py-2.5 grid grid-cols-[160px_1fr_auto] gap-3 text-xs">
                <dt className="text-muted-foreground break-words">{prettyLabel(k)}</dt>
                <dd className="min-w-0 break-words text-foreground">{String(v) || "—"}</dd>
                <CopyField value={String(v)} label={prettyLabel(k)} />
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
                <CopyField value={String(v)} label={`${prettyLabel(k)} link`} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {allTimeline.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Timeline · {timeline.length}/{allTimeline.length}
          </div>
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {TIMELINE_KINDS.map(({ key, label }) => {
              const active = timelineKinds.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setTimelineKinds((k) =>
                      active ? k.filter((x) => x !== key) : [...k, key],
                    )
                  }
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    active
                      ? "border-accent text-accent"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {timeline.length === 0 && (
            <div className="px-4 pb-3 text-xs text-muted-foreground">
              No events match the selected categories.
            </div>
          )}
          <ul className="divide-y divide-border">
            {timeline.map((t, i) => (
              <li key={`${t.label}-${i}`} className="px-4 py-2.5 text-xs flex items-center gap-2">
                <Clock className="size-3 text-muted-foreground shrink-0" />
                <span className="min-w-0 break-words">{t.label}</span>
                <span className="ml-auto text-muted-foreground shrink-0">
                  {t.at.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prefs.showRawPayload ? (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setRawOpen((o) => !o)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {rawOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {rawOpen ? "Hide raw Meta fields" : "View raw Meta fields"}
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
      ) : (
        <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <EyeOff className="size-3" />
          Raw Meta fields and payload are hidden — enable them in Settings → Integrations → Meta.
        </div>
      )}

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
