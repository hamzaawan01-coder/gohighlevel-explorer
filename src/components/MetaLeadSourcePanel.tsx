import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaLeadSource } from "@/lib/meta.functions";
import { Badge } from "@/components/ui/badge";
import { Facebook } from "lucide-react";

/**
 * Shows the Meta origin of a contact or opportunity: which Facebook Page and
 * Lead Ad form it came from, plus the webhook event IDs that created it.
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
  if (isLoading || events.length === 0) return null;

  const latest = events[0];

  const rows: [string, React.ReactNode][] = [
    ["Facebook Page", data?.page?.page_name ?? latest.page_id ?? "—"],
    ["Lead Ad form", latest.form_name ?? latest.form_id ?? "—"],
    ["Landed in", `${data?.pipelineName ?? "—"} · ${data?.stageName ?? "—"}`],
    [
      "Routing",
      latest.routing_source === "mapped" ? "Custom form mapping" : "Default pipeline",
    ],
    ["Meta lead ID", <span className="font-mono text-[10px] break-all">{latest.leadgen_id ?? "—"}</span>],
  ];

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Facebook className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-medium">Lead source</h4>
        {latest.is_test && <Badge variant="outline" className="ml-auto">test</Badge>}
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="px-4 py-2.5 grid grid-cols-[120px_1fr] gap-4 text-xs">
            <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground self-center">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {Object.keys(data?.leadFields ?? {}).length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Form answers
          </div>
          <dl className="divide-y divide-border">
            {Object.entries(data?.leadFields ?? {}).map(([k, v]) => (
              <div key={k} className="px-4 py-2.5 grid grid-cols-[160px_1fr] gap-4 text-xs">
                <dt className="text-muted-foreground break-words">
                  {k.replace(/_/g, " ").replace(/\?$/, "?")}
                </dt>
                <dd className="min-w-0 break-words text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
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
                variant={ev.status === "ok" ? "secondary" : ev.status === "error" ? "destructive" : "outline"}
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
