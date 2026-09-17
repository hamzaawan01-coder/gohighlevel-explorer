import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { fetchFormBySlug, submitForm, type FormField } from "@/lib/lead-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/f/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Contact form` },
      { name: "description", content: "Get in touch." },
    ],
  }),
  component: PublicFormPage,
});

function PublicFormPage() {
  const { slug } = Route.useParams();
  const { data: form, isLoading, error } = useQuery({
    queryKey: ["public-form", slug],
    queryFn: () => fetchFormBySlug(slug),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Form not found</h1>
          <p className="text-sm text-muted-foreground">This form is unavailable or has been disabled.</p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    // client-side required validation
    if (!form) return;
    for (const f of form.fields) {
      if (f.required && !values[f.key]?.trim()) {
        setErrMsg(`${f.label} is required`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await submitForm(form.slug, values);
      if (form.redirect_url) {
        window.location.href = form.redirect_url;
        return;
      }
      setDone(true);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/40 flex items-center justify-center p-6">
      <div className="w-full max-w-lg surface-card p-8">
        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Submitted</h1>
            <p className="text-sm text-muted-foreground">{form.success_message}</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">{form.name}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground mb-6">{form.description}</p>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              {form.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
              {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs mb-1 block">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
        />
      ) : field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-background border border-input rounded-md py-2 px-3 text-sm"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <Input
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={255}
        />
      )}
    </div>
  );
}
