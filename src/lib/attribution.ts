import { supabase } from "@/integrations/supabase/client";

/* ============================ Types ============================ */

export type TouchKind =
  | "contact_created"
  | "lead_ad"
  | "form"
  | "call"
  | "message"
  | "link_click"
  | "manual"
  | "other";

export type ContactTouch = {
  id: string;
  contact_id: string;
  occurred_at: string;
  kind: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  platform: string | null;
  external_campaign_id: string | null;
  referrer: string | null;
  landing_page: string | null;
  click_id: string | null;
};

export type AdSpendRow = {
  id: string;
  sub_account_id: string;
  spend_date: string;
  platform: "google" | "meta" | "linkedin" | "tiktok" | "other";
  campaign_name: string | null;
  external_campaign_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  currency: string;
  entry_source: string;
};

/** One row of the source-to-revenue table. */
export type SourceRow = {
  key: string;
  source: string;
  platform: string | null;
  leads: number;
  deals: number;
  dealValue: number;
  wonDeals: number;
  wonValue: number;
  paidRevenue: number;
  spend: number;
  /** Cost per lead. */
  cpl: number | null;
  /** Cost to acquire one won deal. */
  cac: number | null;
  /** Return on ad spend: paid revenue / spend. */
  roas: number | null;
};

export type AttributionModel = "first" | "last";

export type AttributionReport = {
  model: AttributionModel;
  rows: SourceRow[];
  totals: {
    leads: number;
    deals: number;
    wonDeals: number;
    wonValue: number;
    paidRevenue: number;
    spend: number;
    roas: number | null;
  };
  /** Untracked leads — no source recorded at all. */
  unknownLeads: number;
  currency: string;
};

export type SpendPoint = {
  date: string;
  spend: number;
  clicks: number;
  leads: number;
  revenue: number;
};

export type PlatformRow = {
  platform: string;
  spend: number;
  clicks: number;
  impressions: number;
  reportedLeads: number;
  crmLeads: number;
  wonValue: number;
  paidRevenue: number;
  roas: number | null;
  cpc: number | null;
  cpl: number | null;
};

export type AdRoiReport = {
  series: SpendPoint[];
  platforms: PlatformRow[];
  totals: { spend: number; clicks: number; impressions: number; revenue: number; roas: number | null };
  currency: string;
};

export type CallAnalytics = {
  total: number;
  inbound: number;
  outbound: number;
  answered: number;
  missed: number;
  answerRate: number;
  totalMinutes: number;
  avgDurationSeconds: number;
  byDay: { date: string; inbound: number; outbound: number; answered: number }[];
  byOutcome: { outcome: string; count: number; minutes: number }[];
  byHour: { hour: string; calls: number }[];
  longest: number;
  untagged: number;
};

/* ========================== Helpers ============================ */

const ANSWERED = new Set(["completed", "in-progress", "answered"]);
const MISSED = new Set(["no-answer", "busy", "failed", "canceled", "cancelled"]);

export function normaliseSource(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "unknown" || s === "n/a") return "Unknown";
  if (/facebook|instagram|\bfb\b|meta/.test(s)) return "Meta ads";
  if (/google|adwords|gads/.test(s)) return "Google ads";
  if (/tiktok/.test(s)) return "TikTok";
  if (/linkedin/.test(s)) return "LinkedIn";
  if (/website|web|form|landing/.test(s)) return "Website";
  if (/referr?al|word of mouth/.test(s)) return "Referral";
  if (/organic|seo|search/.test(s)) return "Organic search";
  if (/email|newsletter/.test(s)) return "Email";
  if (/whatsapp|sms|text/.test(s)) return "Messaging";
  if (/import|csv/.test(s)) return "Import";
  return raw!.trim().replace(/^\w/, (c) => c.toUpperCase());
}

/** Map a normalised source label back onto an ad platform, when it is one. */
export function platformForSource(source: string): string | null {
  switch (source) {
    case "Meta ads":
      return "meta";
    case "Google ads":
      return "google";
    case "TikTok":
      return "tiktok";
    case "LinkedIn":
      return "linkedin";
    default:
      return null;
  }
}

export function dayKey(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function rangeDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: dayKey(from), to: dayKey(to) };
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/* ==================== Source → revenue report ==================== */

export async function fetchAttribution(
  subAccountId: string,
  from: string,
  to: string,
  model: AttributionModel = "first",
): Promise<AttributionReport> {
  const fromTs = `${from}T00:00:00.000Z`;
  const toTs = `${to}T23:59:59.999Z`;

  const [touchesRes, contactsRes, dealsRes, stagesRes, invoicesRes, spendRes] = await Promise.all([
    supabase
      .from("contact_touches")
      .select("id,contact_id,occurred_at,kind,source,medium,campaign,platform,external_campaign_id")
      .eq("sub_account_id", subAccountId)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("contacts")
      .select("id,created_at")
      .eq("sub_account_id", subAccountId)
      .gte("created_at", fromTs)
      .lte("created_at", toTs),
    supabase
      .from("deals")
      .select("id,contact_id,value,currency,stage_id,created_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("pipeline_stages")
      .select("id,name,position")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    supabase
      .from("invoices")
      .select("id,contact_id,amount_paid,currency,status,paid_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("ad_spend_daily")
      .select("platform,spend,currency")
      .eq("sub_account_id", subAccountId)
      .gte("spend_date", from)
      .lte("spend_date", to),
  ]);

  const touches = touchesRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const stages = stagesRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const spend = spendRes.data ?? [];

  const currency = deals[0]?.currency || invoices[0]?.currency || spend[0]?.currency || "GBP";
  const wonStageId = stages.length ? stages[stages.length - 1].id : null;

  // Pick the attributed touch per contact (touches arrive oldest-first).
  const attributed = new Map<string, { source: string; platform: string | null }>();
  for (const t of touches) {
    const label = normaliseSource(t.source);
    if (label === "Unknown" && attributed.has(t.contact_id)) continue;
    const existing = attributed.get(t.contact_id);
    if (existing && model === "first") continue;
    attributed.set(t.contact_id, {
      source: label,
      platform: t.platform ?? platformForSource(label),
    });
  }

  const inWindow = new Set(contacts.map((c) => c.id));
  const rows = new Map<string, SourceRow>();
  const row = (source: string, platform: string | null) => {
    const key = source;
    let r = rows.get(key);
    if (!r) {
      r = {
        key,
        source,
        platform,
        leads: 0,
        deals: 0,
        dealValue: 0,
        wonDeals: 0,
        wonValue: 0,
        paidRevenue: 0,
        spend: 0,
        cpl: null,
        cac: null,
        roas: null,
      };
      rows.set(key, r);
    }
    if (!r.platform && platform) r.platform = platform;
    return r;
  };

  let unknownLeads = 0;
  for (const c of contacts) {
    const a = attributed.get(c.id);
    const source = a?.source ?? "Unknown";
    if (source === "Unknown") unknownLeads += 1;
    row(source, a?.platform ?? null).leads += 1;
  }

  for (const d of deals) {
    if (!d.contact_id || !inWindow.has(d.contact_id)) continue;
    const a = attributed.get(d.contact_id);
    const r = row(a?.source ?? "Unknown", a?.platform ?? null);
    r.deals += 1;
    r.dealValue += num(d.value);
    if (wonStageId && d.stage_id === wonStageId) {
      r.wonDeals += 1;
      r.wonValue += num(d.value);
    }
  }

  for (const inv of invoices) {
    if (!inv.contact_id || !inWindow.has(inv.contact_id)) continue;
    const paid = num(inv.amount_paid);
    if (paid <= 0) continue;
    const a = attributed.get(inv.contact_id);
    row(a?.source ?? "Unknown", a?.platform ?? null).paidRevenue += paid;
  }

  const spendByPlatform = new Map<string, number>();
  for (const s of spend) {
    spendByPlatform.set(s.platform, (spendByPlatform.get(s.platform) ?? 0) + num(s.spend));
  }
  for (const r of rows.values()) {
    if (r.platform && spendByPlatform.has(r.platform)) r.spend = spendByPlatform.get(r.platform)!;
    r.cpl = r.spend > 0 && r.leads > 0 ? r.spend / r.leads : null;
    r.cac = r.spend > 0 && r.wonDeals > 0 ? r.spend / r.wonDeals : null;
    const revenue = r.paidRevenue > 0 ? r.paidRevenue : r.wonValue;
    r.roas = r.spend > 0 ? revenue / r.spend : null;
  }

  const list = Array.from(rows.values()).sort(
    (a, b) => b.paidRevenue + b.wonValue - (a.paidRevenue + a.wonValue) || b.leads - a.leads,
  );

  const totals = list.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      deals: acc.deals + r.deals,
      wonDeals: acc.wonDeals + r.wonDeals,
      wonValue: acc.wonValue + r.wonValue,
      paidRevenue: acc.paidRevenue + r.paidRevenue,
      spend: acc.spend,
      roas: null as number | null,
    }),
    { leads: 0, deals: 0, wonDeals: 0, wonValue: 0, paidRevenue: 0, spend: 0, roas: null as number | null },
  );
  totals.spend = Array.from(spendByPlatform.values()).reduce((a, b) => a + b, 0);
  const totalRevenue = totals.paidRevenue > 0 ? totals.paidRevenue : totals.wonValue;
  totals.roas = totals.spend > 0 ? totalRevenue / totals.spend : null;

  return { model, rows: list, totals, unknownLeads, currency };
}

/* ======================= Ad spend / ROI ======================== */

export async function fetchAdRoi(
  subAccountId: string,
  from: string,
  to: string,
): Promise<AdRoiReport> {
  const fromTs = `${from}T00:00:00.000Z`;
  const toTs = `${to}T23:59:59.999Z`;

  const [spendRes, invoicesRes, touchesRes, dealsRes, stagesRes] = await Promise.all([
    supabase
      .from("ad_spend_daily")
      .select("spend_date,platform,spend,clicks,impressions,leads,currency")
      .eq("sub_account_id", subAccountId)
      .gte("spend_date", from)
      .lte("spend_date", to)
      .order("spend_date"),
    supabase
      .from("invoices")
      .select("contact_id,amount_paid,paid_at,currency")
      .eq("sub_account_id", subAccountId)
      .gte("paid_at", fromTs)
      .lte("paid_at", toTs),
    supabase
      .from("contact_touches")
      .select("contact_id,source,platform,occurred_at")
      .eq("sub_account_id", subAccountId)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("deals")
      .select("contact_id,value,stage_id,updated_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("pipeline_stages")
      .select("id,position")
      .eq("sub_account_id", subAccountId)
      .order("position"),
  ]);

  const spend = spendRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const touches = touchesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const stages = stagesRes.data ?? [];
  const wonStageId = stages.length ? stages[stages.length - 1].id : null;
  const currency = spend[0]?.currency || invoices[0]?.currency || "GBP";

  // First touch per contact decides which platform gets the credit.
  const platformOf = new Map<string, string | null>();
  const leadDate = new Map<string, string>();
  for (const t of touches) {
    if (platformOf.has(t.contact_id)) continue;
    platformOf.set(t.contact_id, t.platform ?? platformForSource(normaliseSource(t.source)));
    leadDate.set(t.contact_id, dayKey(t.occurred_at));
  }

  const platforms = new Map<string, PlatformRow>();
  const prow = (platform: string) => {
    let r = platforms.get(platform);
    if (!r) {
      r = {
        platform,
        spend: 0,
        clicks: 0,
        impressions: 0,
        reportedLeads: 0,
        crmLeads: 0,
        wonValue: 0,
        paidRevenue: 0,
        roas: null,
        cpc: null,
        cpl: null,
      };
      platforms.set(platform, r);
    }
    return r;
  };

  const byDay = new Map<string, SpendPoint>();
  const point = (date: string) => {
    let p = byDay.get(date);
    if (!p) {
      p = { date, spend: 0, clicks: 0, leads: 0, revenue: 0 };
      byDay.set(date, p);
    }
    return p;
  };

  for (const s of spend) {
    const r = prow(s.platform);
    r.spend += num(s.spend);
    r.clicks += num(s.clicks);
    r.impressions += num(s.impressions);
    r.reportedLeads += num(s.leads);
    const p = point(s.spend_date);
    p.spend += num(s.spend);
    p.clicks += num(s.clicks);
  }

  for (const [contactId, platform] of platformOf.entries()) {
    if (!platform) continue;
    const d = leadDate.get(contactId);
    if (!d || d < from || d > to) continue;
    prow(platform).crmLeads += 1;
    point(d).leads += 1;
  }

  for (const inv of invoices) {
    const paid = num(inv.amount_paid);
    if (paid <= 0) continue;
    const platform = inv.contact_id ? platformOf.get(inv.contact_id) : null;
    if (platform) prow(platform).paidRevenue += paid;
    if (inv.paid_at) point(dayKey(inv.paid_at)).revenue += paid;
  }

  for (const d of deals) {
    if (!wonStageId || d.stage_id !== wonStageId || !d.contact_id) continue;
    const platform = platformOf.get(d.contact_id);
    if (platform) prow(platform).wonValue += num(d.value);
  }

  for (const r of platforms.values()) {
    const revenue = r.paidRevenue > 0 ? r.paidRevenue : r.wonValue;
    r.roas = r.spend > 0 ? revenue / r.spend : null;
    r.cpc = r.clicks > 0 ? r.spend / r.clicks : null;
    const leads = r.crmLeads || r.reportedLeads;
    r.cpl = leads > 0 ? r.spend / leads : null;
  }

  // Fill every day in the range so the chart has no gaps.
  const series: SpendPoint[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); dayKey(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    series.push(byDay.get(dayKey(d)) ?? { date: dayKey(d), spend: 0, clicks: 0, leads: 0, revenue: 0 });
  }

  const totals = series.reduce(
    (a, p) => ({
      spend: a.spend + p.spend,
      clicks: a.clicks + p.clicks,
      impressions: a.impressions,
      revenue: a.revenue + p.revenue,
      roas: null as number | null,
    }),
    { spend: 0, clicks: 0, impressions: 0, revenue: 0, roas: null as number | null },
  );
  totals.impressions = Array.from(platforms.values()).reduce((a, r) => a + r.impressions, 0);
  totals.roas = totals.spend > 0 ? totals.revenue / totals.spend : null;

  return {
    series,
    platforms: Array.from(platforms.values()).sort((a, b) => b.spend - a.spend),
    totals,
    currency,
  };
}

export async function listAdSpend(
  subAccountId: string,
  from: string,
  to: string,
): Promise<AdSpendRow[]> {
  const { data, error } = await supabase
    .from("ad_spend_daily")
    .select(
      "id,sub_account_id,spend_date,platform,campaign_name,external_campaign_id,spend,impressions,clicks,leads,currency,entry_source",
    )
    .eq("sub_account_id", subAccountId)
    .gte("spend_date", from)
    .lte("spend_date", to)
    .order("spend_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdSpendRow[];
}

export type AdSpendInput = {
  sub_account_id: string;
  spend_date: string;
  platform: AdSpendRow["platform"];
  campaign_name?: string | null;
  external_campaign_id?: string | null;
  spend: number;
  impressions?: number;
  clicks?: number;
  leads?: number;
  currency?: string;
};

export async function saveAdSpend(input: AdSpendInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("ad_spend_daily").insert({
    ...input,
    campaign_name: input.campaign_name || null,
    external_campaign_id: input.external_campaign_id || null,
    impressions: input.impressions ?? 0,
    clicks: input.clicks ?? 0,
    leads: input.leads ?? 0,
    currency: input.currency ?? "GBP",
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateAdSpend(id: string, patch: Partial<AdSpendInput>): Promise<void> {
  const { error } = await supabase.from("ad_spend_daily").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAdSpend(id: string): Promise<void> {
  const { error } = await supabase.from("ad_spend_daily").delete().eq("id", id);
  if (error) throw error;
}

/* ======================= Call analytics ======================== */

export const CALL_OUTCOMES = [
  "Connected",
  "Booked appointment",
  "Callback requested",
  "Not interested",
  "Wrong number",
  "Voicemail",
  "No answer",
] as const;

export async function fetchCallAnalytics(
  subAccountId: string,
  from: string,
  to: string,
): Promise<CallAnalytics> {
  const { data, error } = await supabase
    .from("phone_calls")
    .select("id,direction,status,duration_seconds,created_at,started_at,outcome")
    .eq("sub_account_id", subAccountId)
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`)
    .order("created_at");
  if (error) throw error;
  const calls = data ?? [];

  const byDay = new Map<string, { date: string; inbound: number; outbound: number; answered: number }>();
  const byOutcome = new Map<string, { outcome: string; count: number; minutes: number }>();
  const byHour = new Map<number, number>();

  let inbound = 0;
  let outbound = 0;
  let answered = 0;
  let missed = 0;
  let seconds = 0;
  let longest = 0;
  let untagged = 0;

  for (const c of calls) {
    const day = dayKey(c.created_at);
    const d = byDay.get(day) ?? { date: day, inbound: 0, outbound: 0, answered: 0 };
    const isInbound = (c.direction ?? "").toLowerCase().startsWith("in");
    if (isInbound) {
      inbound += 1;
      d.inbound += 1;
    } else {
      outbound += 1;
      d.outbound += 1;
    }

    const status = (c.status ?? "").toLowerCase();
    const dur = num(c.duration_seconds);
    const isAnswered = ANSWERED.has(status) || (!MISSED.has(status) && dur > 0);
    if (isAnswered) {
      answered += 1;
      d.answered += 1;
    } else if (MISSED.has(status) || dur === 0) {
      missed += 1;
    }
    byDay.set(day, d);

    seconds += dur;
    if (dur > longest) longest = dur;

    const hour = new Date(c.started_at ?? c.created_at).getHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);

    const outcome = (c.outcome ?? "").trim();
    if (!outcome) untagged += 1;
    const label = outcome || "Untagged";
    const o = byOutcome.get(label) ?? { outcome: label, count: 0, minutes: 0 };
    o.count += 1;
    o.minutes += dur / 60;
    byOutcome.set(label, o);
  }

  const series: CallAnalytics["byDay"] = [];
  for (let d = new Date(`${from}T00:00:00Z`); dayKey(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    series.push(byDay.get(dayKey(d)) ?? { date: dayKey(d), inbound: 0, outbound: 0, answered: 0 });
  }

  return {
    total: calls.length,
    inbound,
    outbound,
    answered,
    missed,
    answerRate: calls.length ? (answered / calls.length) * 100 : 0,
    totalMinutes: Math.round(seconds / 60),
    avgDurationSeconds: answered ? Math.round(seconds / answered) : 0,
    byDay: series,
    byOutcome: Array.from(byOutcome.values()).sort((a, b) => b.count - a.count),
    byHour: Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      calls: byHour.get(h) ?? 0,
    })),
    longest,
    untagged,
  };
}

export async function setCallOutcome(
  callId: string,
  outcome: string | null,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("phone_calls")
    .update({ outcome: outcome || null, outcome_note: note ?? null })
    .eq("id", callId);
  if (error) throw error;
}

/** Record a manual touchpoint for a contact (used by the contact panel). */
export async function recordTouch(input: {
  sub_account_id: string;
  contact_id: string;
  source: string;
  medium?: string | null;
  campaign?: string | null;
  platform?: string | null;
  kind?: TouchKind;
  occurred_at?: string;
}): Promise<void> {
  const { error } = await supabase.from("contact_touches").insert({
    sub_account_id: input.sub_account_id,
    contact_id: input.contact_id,
    source: input.source,
    medium: input.medium ?? null,
    campaign: input.campaign ?? null,
    platform: input.platform ?? platformForSource(normaliseSource(input.source)),
    kind: input.kind ?? "manual",
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchContactTouches(contactId: string): Promise<ContactTouch[]> {
  const { data, error } = await supabase
    .from("contact_touches")
    .select(
      "id,contact_id,occurred_at,kind,source,medium,campaign,platform,external_campaign_id,referrer,landing_page,click_id",
    )
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContactTouch[];
}
