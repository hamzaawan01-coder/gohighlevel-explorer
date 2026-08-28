import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string } | null {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const provided = base64UrlDecode(encodedSig);
  if (expected.length !== provided.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  if (diff !== 0) return null;
  try {
    return JSON.parse(base64UrlDecode(payload).toString("utf8"));
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/meta/data-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) return new Response("Not configured", { status: 500 });

        let signedRequest: string | null = null;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const body = (await request.json().catch(() => null)) as { signed_request?: string } | null;
          signedRequest = body?.signed_request ?? null;
        } else {
          const form = await request.formData().catch(() => null);
          signedRequest = (form?.get("signed_request") as string | null) ?? null;
        }
        if (!signedRequest) return new Response("Missing signed_request", { status: 400 });

        const parsed = parseSignedRequest(signedRequest, appSecret);
        if (!parsed?.user_id) return new Response("Invalid signed_request", { status: 401 });

        const metaUserId = String(parsed.user_id);
        const confirmationCode = `del_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let deletedConversations = 0;
        const { data: convs } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("external_thread_id", metaUserId);

        if (convs && convs.length > 0) {
          const ids = convs.map((c) => c.id);
          await supabaseAdmin.from("messages").delete().in("conversation_id", ids);
          const { error } = await supabaseAdmin.from("conversations").delete().in("id", ids);
          if (!error) deletedConversations = ids.length;
        }

        await supabaseAdmin.from("meta_deletion_requests").insert({
          confirmation_code: confirmationCode,
          meta_user_id: metaUserId,
          status: "completed",
          deleted_counts: { conversations: deletedConversations },
        });

        const origin = new URL(request.url).origin;
        return Response.json({
          url: `${origin}/data-deletion?code=${confirmationCode}`,
          confirmation_code: confirmationCode,
        });
      },
    },
  },
});
