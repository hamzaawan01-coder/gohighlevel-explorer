import { supabase } from "@/integrations/supabase/client";

export type SearchHit =
  | { kind: "contact"; id: string; title: string; subtitle: string | null }
  | { kind: "deal"; id: string; title: string; subtitle: string | null }
  | { kind: "task"; id: string; title: string; subtitle: string | null }
  | { kind: "event"; id: string; title: string; subtitle: string | null };

const esc = (s: string) => s.replace(/[%,]/g, " ").trim();

export async function globalSearch(
  subAccountId: string,
  query: string,
  opts?: { kinds?: SearchHit["kind"][] },
): Promise<SearchHit[]> {
  const q = esc(query);
  if (!q) return [];
  const allow = (k: SearchHit["kind"]) => !opts?.kinds || opts.kinds.includes(k);
  const like = `%${q}%`;

  const [contacts, deals, tasks, events] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, company")
      .eq("sub_account_id", subAccountId)
      .is("deleted_at", null)
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company.ilike.${like}`,
      )
      .limit(6),
    supabase
      .from("deals")
      .select("id, title, value")
      .eq("sub_account_id", subAccountId)
      .is("deleted_at", null)
      .ilike("title", like)
      .limit(6),
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("sub_account_id", subAccountId)
      .is("deleted_at", null)
      .ilike("title", like)
      .limit(6),
    supabase
      .from("calendar_events")
      .select("id, title, starts_at")
      .eq("sub_account_id", subAccountId)
      .ilike("title", like)
      .limit(6),
  ]);

  const hits: SearchHit[] = [];
  void allow;
  for (const c of contacts.data ?? []) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Untitled";
    hits.push({ kind: "contact", id: c.id, title: name, subtitle: c.company ?? c.email });
  }
  for (const d of deals.data ?? []) {
    hits.push({
      kind: "deal",
      id: d.id,
      title: d.title,
      subtitle: d.value ? `$${Number(d.value).toLocaleString()}` : null,
    });
  }
  for (const t of tasks.data ?? []) {
    hits.push({ kind: "task", id: t.id, title: t.title, subtitle: t.status });
  }
  for (const e of events.data ?? []) {
    hits.push({
      kind: "event",
      id: e.id,
      title: e.title,
      subtitle: e.starts_at ? new Date(e.starts_at).toLocaleString() : null,
    });
  }
  return hits.filter((h) => allow(h.kind));
}
