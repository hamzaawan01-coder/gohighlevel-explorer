// Client-side helpers for personalization tokens like {{contact.first_name}}.
// The DB function render_merge_tags does the real substitution at send time;
// these are used for pickers, previews, and plain-English summaries.

export type MergeTag = {
  token: string; // e.g. "contact.first_name"
  label: string; // e.g. "Contact first name"
  sample: string; // used for previews
  scopes: Array<"contact" | "deal" | "workflow">;
};

export const MERGE_TAGS: MergeTag[] = [
  { token: "contact.first_name", label: "Contact first name", sample: "Alex", scopes: ["contact"] },
  { token: "contact.last_name", label: "Contact last name", sample: "Chen", scopes: ["contact"] },
  { token: "contact.full_name", label: "Contact full name", sample: "Alex Chen", scopes: ["contact"] },
  { token: "contact.email", label: "Contact email", sample: "alex@example.com", scopes: ["contact"] },
  { token: "contact.phone", label: "Contact phone", sample: "+15551234567", scopes: ["contact"] },
  { token: "contact.company", label: "Contact company", sample: "Acme Inc.", scopes: ["contact"] },
  { token: "deal.name", label: "Deal name", sample: "Website redesign", scopes: ["deal"] },
  { token: "deal.amount", label: "Deal amount", sample: "5000", scopes: ["deal"] },
  { token: "workflow.name", label: "Workflow name", sample: "New enquiry follow-up", scopes: ["workflow"] },
];

export function renderMergeTagsPreview(tpl: string | null | undefined): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) => {
    const t = MERGE_TAGS.find((x) => x.token === path);
    return t ? t.sample : "";
  });
}

export function insertAtCaret(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  insert: string,
): { next: string; caret: number } {
  if (!el) return { next: current + insert, caret: (current + insert).length };
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + insert + current.slice(end);
  return { next, caret: start + insert.length };
}
