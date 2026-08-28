import { describe, expect, it } from "vitest";
import { filterConversations, isUnread, type Conversation } from "@/lib/conversations";
import { AUDIT_ACTIONS, filterAuditRows, type AuditEntry } from "@/lib/appointments";

const base = {
  sub_account_id: "s1",
  contact_id: null,
  external_thread_id: null,
  last_message_at: "2026-09-07T10:00:00.000Z",
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-07T10:00:00.000Z",
} as unknown as Conversation;

const convos = [
  { ...base, id: "a", channel: "sms", status: "open", assigned_to_user_id: "u1" },
  { ...base, id: "b", channel: "email", status: "closed", assigned_to_user_id: null },
  { ...base, id: "c", channel: "sms", status: "open", assigned_to_user_id: "u2" },
] as unknown as Conversation[];

describe("filterConversations", () => {
  it("returns everything with no filters", () => {
    expect(filterConversations(convos, {})).toHaveLength(3);
  });

  it("filters by channel", () => {
    expect(filterConversations(convos, { channel: "sms" }).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("filters by status", () => {
    expect(filterConversations(convos, { status: "closed" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("filters assigned-to-me", () => {
    expect(
      filterConversations(convos, { assignee: "mine", currentUserId: "u1" }).map((c) => c.id),
    ).toEqual(["a"]);
  });

  it("filters unassigned", () => {
    expect(filterConversations(convos, { assignee: "unassigned" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("combines filters", () => {
    expect(
      filterConversations(convos, {
        channel: "sms",
        status: "open",
        assignee: "mine",
        currentUserId: "u2",
      }).map((c) => c.id),
    ).toEqual(["c"]);
  });
});

describe("isUnread", () => {
  it("is unread when never read", () => {
    expect(isUnread({ ...base, last_read_at: null } as unknown as Conversation)).toBe(true);
  });

  it("is read when read after the last message", () => {
    expect(
      isUnread({
        ...base,
        last_read_at: "2026-09-07T11:00:00.000Z",
      } as unknown as Conversation),
    ).toBe(false);
  });

  it("is unread when a newer message arrived", () => {
    expect(
      isUnread({
        ...base,
        last_read_at: "2026-09-07T09:00:00.000Z",
      } as unknown as Conversation),
    ).toBe(true);
  });
});

describe("audit log filtering", () => {
  const rows = [
    { id: "1", action: "booked", detail: "Ada booked Discovery call", actor_label: "Public form", channel: null },
    { id: "2", action: "reminder_sent", detail: "24 hours before", actor_label: null, channel: "sms" },
    { id: "3", action: "cancelled", detail: "Cancelled by owner", actor_label: "ada@example.com", channel: null },
  ] as unknown as AuditEntry[];

  it("returns all rows with an empty query", () => {
    expect(filterAuditRows(rows, "  ")).toHaveLength(3);
  });

  it("matches on detail, actor and channel", () => {
    expect(filterAuditRows(rows, "discovery").map((r) => r.id)).toEqual(["1"]);
    expect(filterAuditRows(rows, "ada@").map((r) => r.id)).toEqual(["3"]);
    expect(filterAuditRows(rows, "SMS").map((r) => r.id)).toEqual(["2"]);
  });

  it("matches on action name", () => {
    expect(filterAuditRows(rows, "reminder").map((r) => r.id)).toEqual(["2"]);
  });

  it("exposes a label for every audit action", () => {
    expect(AUDIT_ACTIONS.every((a) => a.label.length > 0)).toBe(true);
  });
});
