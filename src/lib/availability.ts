/**
 * Pure availability maths shared by the public booking endpoint and the
 * reschedule endpoint. No imports, no I/O — so it is unit testable.
 */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_ORDER: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type Availability = Partial<Record<DayKey, { start: string; end: string }[]>>;

export type SlotRules = {
  availability: Availability;
  durationMinutes: number;
  bufferMinutes: number;
  advanceDays: number;
  minNoticeMinutes: number;
};

export type BusyRange = { starts_at: string; ends_at: string };

/** Candidate slot start times inside the booking window (before busy filtering). */
export function candidateSlots(rules: SlotRules, now = new Date()): Date[] {
  const minStart = new Date(now.getTime() + rules.minNoticeMinutes * 60_000);
  const horizon = new Date(now.getTime() + rules.advanceDays * 24 * 60 * 60_000);
  const step = Math.max(1, rules.durationMinutes + rules.bufferMinutes) * 60_000;
  const out: Date[] = [];

  for (const cursor = new Date(now); cursor <= horizon; cursor.setDate(cursor.getDate() + 1)) {
    const dayKey = DAY_ORDER[cursor.getDay()];
    for (const w of rules.availability?.[dayKey] ?? []) {
      const [sh, sm] = w.start.split(":").map(Number);
      const [eh, em] = w.end.split(":").map(Number);
      const dayStart = new Date(cursor);
      dayStart.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(eh, em, 0, 0);
      for (
        let t = dayStart.getTime();
        t + rules.durationMinutes * 60_000 <= dayEnd.getTime();
        t += step
      ) {
        const slot = new Date(t);
        if (slot >= minStart && slot <= horizon) out.push(slot);
      }
    }
  }
  return out;
}

/** True when [start, start+duration) overlaps any busy range. */
export function overlapsBusy(
  start: Date,
  durationMinutes: number,
  busy: BusyRange[],
  ignoreEventKeys: string[] = [],
): boolean {
  const s = start.getTime();
  const e = s + durationMinutes * 60_000;
  return busy
    .filter((b) => !ignoreEventKeys.includes(`${b.starts_at}|${b.ends_at}`))
    .some((b) => s < new Date(b.ends_at).getTime() && e > new Date(b.starts_at).getTime());
}

/** Free slot start times as ISO strings. */
export function freeSlots(
  rules: SlotRules,
  busy: BusyRange[],
  now = new Date(),
  limit = 200,
): string[] {
  return candidateSlots(rules, now)
    .filter((c) => !overlapsBusy(c, rules.durationMinutes, busy))
    .slice(0, limit)
    .map((d) => d.toISOString());
}

/** Whether a requested start time is bookable under the rules + busy list. */
export function isSlotBookable(
  startIso: string,
  rules: SlotRules,
  busy: BusyRange[],
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Invalid start time" };
  if (start.getTime() < now.getTime() + rules.minNoticeMinutes * 60_000) {
    return { ok: false, reason: "Too soon — outside the minimum notice window" };
  }
  const horizon = now.getTime() + rules.advanceDays * 24 * 60 * 60_000;
  if (start.getTime() > horizon) return { ok: false, reason: "Outside the booking window" };
  if (overlapsBusy(start, rules.durationMinutes, busy)) {
    return { ok: false, reason: "Slot no longer available" };
  }
  return { ok: true };
}
