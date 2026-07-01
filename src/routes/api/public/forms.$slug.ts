import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  payload: z.record(z.string(), z.string().max(2000)),
  source_url: z.string().max(500).nullable().optional(),
});

const CONTACT_KEYS = new Set(["email", "first_name", "last_name", "phone", "company"]);

export const Route = createFileRoute("/api/public/forms/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const slug = params.slug;
        if (!slug || slug.length > 100) {
          return new Response("Bad slug", { status: 400 });
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: form, error: fErr } = await supabaseAdmin
          .from("lead_forms")
          .select("id, sub_account_id, owner_id, enabled, fields")
          .eq("slug", slug)
          .maybeSingle();
        if (fErr || !form || !form.enabled) {
          return new Response("Form not found", { status: 404 });
        }

        // Split payload: contact-mapped fields vs. extras
        const contactPatch: Record<string, string> = {};
        const extras: Record<string, string> = {};
        for (const [k, v] of Object.entries(body.payload)) {
          const val = String(v ?? "").trim();
          if (!val) continue;
          if (CONTACT_KEYS.has(k)) contactPatch[k] = val.slice(0, 255);
          else extras[k] = val.slice(0, 2000);
        }

        let contactId: string | null = null;
        if (contactPatch.email) {
          // Upsert-by-email within this sub_account
          const { data: existing } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("sub_account_id", form.sub_account_id)
            .eq("email", contactPatch.email)
            .maybeSingle();

          if (existing?.id) {
            contactId = existing.id;
            await supabaseAdmin.from("contacts").update(contactPatch as never).eq("id", existing.id);
          } else {
            const { data: created, error: cErr } = await supabaseAdmin
              .from("contacts")
              .insert({
                ...contactPatch,
                sub_account_id: form.sub_account_id,
                owner_id: form.owner_id,
                lifecycle_stage: "lead",
                lead_source: "Form",
                tags: [],
              })
              .select("id")
              .single();
            if (cErr) return new Response("Could not create contact", { status: 500 });
            contactId = created.id;
          }
        }

        const { error: sErr } = await supabaseAdmin.from("form_submissions").insert({
          form_id: form.id,
          sub_account_id: form.sub_account_id,
          contact_id: contactId,
          payload: { ...contactPatch, ...extras },
          source_url: body.source_url ?? null,
        });
        if (sErr) return new Response("Could not save submission", { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
