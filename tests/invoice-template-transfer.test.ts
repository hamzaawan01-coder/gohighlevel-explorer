import { describe, expect, it } from "vitest";
import {
  diffTemplates,
  parseTemplateFile,
  templatesToCsv,
  templatesToJson,
} from "@/lib/invoice-template-transfer";
import type { InvoiceTemplate } from "@/lib/invoice-templates";

function tpl(over: Partial<InvoiceTemplate> = {}): InvoiceTemplate {
  return {
    id: "t1",
    sub_account_id: "s1",
    name: "Default",
    version: 1,
    is_default: true,
    archived_at: null,
    business_name: "Acme",
    logo_url: null,
    accent_color: "#4f46e5",
    address: "1 High St, London",
    payment_instructions: "Bank transfer",
    terms: "Due in 14 days",
    footer_note: "Thanks!",
    created_at: "",
    updated_at: "",
    ...over,
  } as InvoiceTemplate;
}

describe("invoice template transfer", () => {
  it("round-trips a JSON export", () => {
    const parsed = parseTemplateFile(templatesToJson([tpl(), tpl({ id: "t2", name: "White label" })]));
    expect(parsed.map((t) => t.name)).toEqual(["Default", "White label"]);
    expect(parsed[0]?.terms).toBe("Due in 14 days");
  });

  it("round-trips a CSV export with commas in fields", () => {
    const parsed = parseTemplateFile(templatesToCsv([tpl()]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.address).toBe("1 High St, London");
  });

  it("rejects a CSV without a name column", () => {
    expect(() => parseTemplateFile("terms,footer_note\na,b")).toThrow(/name/);
  });

  it("diffs two versions field by field", () => {
    const rows = diffTemplates(tpl(), tpl({ version: 2, terms: "Due in 7 days" }));
    const changed = rows.filter((r) => r.changed).map((r) => r.field);
    expect(changed).toEqual(["terms"]);
  });
});
