import { useRef, useState } from "react";
import { Upload, Download, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  parseContactsCsv,
  importContacts,
  sampleCsv,
  downloadCsv,
  type ParsedImport,
} from "@/lib/contacts-csv";
import { useQueryClient } from "@tanstack/react-query";

export function ContactsImportDialog({
  open,
  onOpenChange,
  ownerId,
  subAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerId: string;
  subAccountId: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [running, setRunning] = useState(false);

  function reset() {
    setParsed(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(f: File) {
    const text = await f.text();
    const result = parseContactsCsv(text);
    setParsed(result);
    setFileName(f.name);
  }

  async function runImport() {
    if (!parsed) return;
    setRunning(true);
    try {
      const r = await importContacts(parsed.rows, ownerId, subAccountId);
      toast.success(
        `Imported: ${r.inserted} new, ${r.updated} updated${r.failed ? `, ${r.failed} failed` : ""}`,
      );
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            Rows with a matching email will be updated in place. Others are inserted as new contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Expected columns:</span>
            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
              first_name, last_name, email, phone, company, lifecycle_stage, lead_source, tags, notes
            </code>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv("contacts-template.csv", sampleCsv())}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
          >
            <Download className="size-3" /> Download template
          </button>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-6 cursor-pointer hover:bg-muted/40 transition-colors">
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {fileName ? fileName : "Click to select a .csv file"}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>

          {parsed && (
            <div className="rounded-md border border-border p-3 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5" />
                <span className="font-medium">{parsed.rows.length} valid row{parsed.rows.length === 1 ? "" : "s"}</span>
                {parsed.errors.length > 0 && (
                  <span className="text-destructive">· {parsed.errors.length} skipped</span>
                )}
              </div>
              {parsed.errors.length > 0 && (
                <ul className="max-h-24 overflow-auto text-[11px] text-muted-foreground space-y-0.5">
                  {parsed.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>Line {e.line}: {e.message}</li>
                  ))}
                  {parsed.errors.length > 8 && <li>…and {parsed.errors.length - 8} more</li>}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
            <Button
              onClick={runImport}
              disabled={!parsed || parsed.rows.length === 0 || running}
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : `Import ${parsed?.rows.length ?? 0} contacts`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
