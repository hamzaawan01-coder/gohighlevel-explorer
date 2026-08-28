import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Small copy-to-clipboard affordance used for lead modal field values. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const clean = String(value ?? "").trim();
  if (!clean || clean === "—") return null;

  return (
    <button
      type="button"
      aria-label={label ? `Copy ${label}` : "Copy value"}
      title={label ? `Copy ${label}` : "Copy value"}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(clean);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = clean;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
    </button>
  );
}
