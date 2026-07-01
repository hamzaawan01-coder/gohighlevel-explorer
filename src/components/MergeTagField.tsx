import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MERGE_TAGS, insertAtCaret, renderMergeTagsPreview } from "@/lib/merge-tags";

export function MergeTagField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  showPreview = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  showPreview?: boolean;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  function insertToken(token: string) {
    const el = ref.current;
    const { next, caret } = insertAtCaret(el, value, `{{${token}}}`);
    onChange(next);
    // restore caret
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        // ignore
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px]">{label}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Insert field <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider">
              Personalization tokens
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MERGE_TAGS.map((t) => (
              <DropdownMenuItem
                key={t.token}
                onSelect={(e) => {
                  e.preventDefault();
                  insertToken(t.token);
                }}
                className="text-xs flex flex-col items-start gap-0"
              >
                <span>{t.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{`{{${t.token}}}`}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {multiline ? (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="text-xs"
        />
      ) : (
        <Input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {showPreview && value.includes("{{") && (
        <p className="text-[10px] text-muted-foreground italic">
          Preview: {renderMergeTagsPreview(value)}
        </p>
      )}
    </div>
  );
}
