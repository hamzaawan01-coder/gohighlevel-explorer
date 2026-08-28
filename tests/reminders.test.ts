import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_TEMPLATE, renderReminder } from "@/lib/appointments.server";
import { offsetLabel, REMINDER_PRESETS, reminderChannelLabel } from "@/lib/appointments";

const vars = { title: "Discovery call", date: "Mon, 7 Sep", time: "10:00", name: "Ada" };

describe("renderReminder", () => {
  it("substitutes every merge tag", () => {
    const out = renderReminder("Hi {{name}}, {{title}} on {{date}} at {{time}}.", vars);
    expect(out).toBe("Hi Ada, Discovery call on Mon, 7 Sep at 10:00.");
  });

  it("is whitespace and case tolerant", () => {
    expect(renderReminder("{{ NAME }} / {{Title}}", vars)).toBe("Ada / Discovery call");
  });

  it("falls back to the default template when blank", () => {
    expect(renderReminder("   ", vars)).toBe(
      renderReminder(DEFAULT_REMINDER_TEMPLATE, vars),
    );
    expect(renderReminder(null, vars)).toContain("Discovery call");
  });
});

describe("reminder offsets", () => {
  it("labels presets and derived offsets", () => {
    expect(offsetLabel(1440)).toBe("24 hours before");
    expect(offsetLabel(4320)).toBe("3 day(s) before");
    expect(offsetLabel(180)).toBe("3 hour(s) before");
    expect(offsetLabel(7)).toBe("7 min before");
  });

  it("keeps presets ordered from earliest to latest", () => {
    const mins = REMINDER_PRESETS.map((p) => p.minutes);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });

  it("computes send times relative to the appointment start", () => {
    const start = new Date("2026-09-07T10:00:00.000Z").getTime();
    const sendTimes = [1440, 60].map((m) => new Date(start - m * 60_000).toISOString());
    expect(sendTimes).toEqual([
      "2026-09-06T10:00:00.000Z",
      "2026-09-07T09:00:00.000Z",
    ]);
  });

  it("labels reminder channels for the UI", () => {
    expect(reminderChannelLabel("in_app")).toBe("In-app");
    expect(reminderChannelLabel("sms")).toBe("SMS");
    expect(reminderChannelLabel("email")).toBe("EMAIL");
  });
});
