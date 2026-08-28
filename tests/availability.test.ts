import { describe, expect, it } from "vitest";
import {
  candidateSlots,
  freeSlots,
  isSlotBookable,
  overlapsBusy,
  type SlotRules,
} from "@/lib/availability";

/** Fixed "now": Monday 2026-09-07 09:00 local. */
const NOW = new Date(2026, 8, 7, 9, 0, 0, 0);

const rules: SlotRules = {
  availability: { mon: [{ start: "10:00", end: "12:00" }] },
  durationMinutes: 30,
  bufferMinutes: 0,
  advanceDays: 1,
  minNoticeMinutes: 60,
};

describe("candidateSlots", () => {
  it("generates slots only inside configured windows", () => {
    const slots = candidateSlots(rules, NOW);
    expect(slots).toHaveLength(4); // 10:00, 10:30, 11:00, 11:30
    expect(slots[0].getHours()).toBe(10);
    expect(slots.at(-1)!.getHours()).toBe(11);
    expect(slots.at(-1)!.getMinutes()).toBe(30);
  });

  it("respects the minimum notice window", () => {
    const slots = candidateSlots({ ...rules, minNoticeMinutes: 150 }, NOW); // >= 11:30
    expect(slots).toHaveLength(1);
    expect(slots[0].getHours()).toBe(11);
  });

  it("applies the buffer between slots", () => {
    const slots = candidateSlots({ ...rules, bufferMinutes: 30 }, NOW);
    expect(slots).toHaveLength(2); // 10:00 and 11:00
  });

  it("returns nothing when the day has no availability", () => {
    expect(candidateSlots({ ...rules, availability: { sat: [] } }, NOW)).toHaveLength(0);
  });
});

describe("overlapsBusy", () => {
  const busy = [
    {
      starts_at: new Date(2026, 8, 7, 10, 0).toISOString(),
      ends_at: new Date(2026, 8, 7, 10, 30).toISOString(),
    },
  ];

  it("detects an exact clash", () => {
    expect(overlapsBusy(new Date(2026, 8, 7, 10, 0), 30, busy)).toBe(true);
  });

  it("allows a back-to-back booking", () => {
    expect(overlapsBusy(new Date(2026, 8, 7, 10, 30), 30, busy)).toBe(false);
  });

  it("ignores excluded ranges (used when rescheduling the same event)", () => {
    const key = `${busy[0].starts_at}|${busy[0].ends_at}`;
    expect(overlapsBusy(new Date(2026, 8, 7, 10, 0), 30, busy, [key])).toBe(false);
  });
});

describe("freeSlots", () => {
  it("removes booked times", () => {
    const busy = [
      {
        starts_at: new Date(2026, 8, 7, 10, 0).toISOString(),
        ends_at: new Date(2026, 8, 7, 11, 0).toISOString(),
      },
    ];
    const slots = freeSlots(rules, busy, NOW);
    expect(slots).toHaveLength(2);
    expect(new Date(slots[0]).getHours()).toBe(11);
  });

  it("honours the limit", () => {
    expect(freeSlots(rules, [], NOW, 2)).toHaveLength(2);
  });
});

describe("isSlotBookable", () => {
  it("accepts a free in-window slot", () => {
    const res = isSlotBookable(new Date(2026, 8, 7, 11, 0).toISOString(), rules, [], NOW);
    expect(res.ok).toBe(true);
  });

  it("rejects a slot inside the notice window", () => {
    const res = isSlotBookable(new Date(2026, 8, 7, 9, 15).toISOString(), rules, [], NOW);
    expect(res).toMatchObject({ ok: false });
  });

  it("rejects a slot beyond the booking horizon", () => {
    const res = isSlotBookable(new Date(2026, 8, 20, 10, 0).toISOString(), rules, [], NOW);
    expect(res).toMatchObject({ ok: false });
  });

  it("rejects a clashing slot", () => {
    const busy = [
      {
        starts_at: new Date(2026, 8, 7, 11, 0).toISOString(),
        ends_at: new Date(2026, 8, 7, 11, 30).toISOString(),
      },
    ];
    const res = isSlotBookable(new Date(2026, 8, 7, 11, 0).toISOString(), rules, busy, NOW);
    expect(res).toMatchObject({ ok: false, reason: "Slot no longer available" });
  });

  it("rejects an invalid timestamp", () => {
    expect(isSlotBookable("not-a-date", rules, [], NOW)).toMatchObject({ ok: false });
  });
});
