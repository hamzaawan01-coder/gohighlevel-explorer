// Twilio server functions — called from the browser via useServerFn.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  verifyTwilioCredentials,
  searchAvailableNumbers,
  getNumberPrice,
  purchaseNumber,
  releaseNumber,
  updateNumberWebhooks,
  voiceWebhookUrl,
  smsWebhookUrl,
  statusWebhookUrl,
} from "./twilio.server";

async function ensureAdmin(supabase: any, userId: string, subId: string) {
  const { data, error } = await supabase.rpc("is_subaccount_admin", { _user: userId, _sub: subId });
  if (error || !data) throw new Error("Only workspace admins can manage Twilio");
}
async function ensureMember(supabase: any, userId: string, subId: string) {
  const { data, error } = await supabase.rpc("has_subaccount_access", { _user: userId, _sub: subId });
  if (error || !data) throw new Error("Forbidden: no access to this workspace");
}

async function loadConnection(subId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("twilio_connections")
    .select("id, account_sid, api_key_sid, api_key_secret, webhook_token")
    .eq("sub_account_id", subId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Twilio is not connected for this workspace yet.");
  return data as {
    id: string;
    account_sid: string;
    api_key_sid: string;
    api_key_secret: string;
    webhook_token: string;
  };
}

/** Connect / update a Twilio account for a sub-account. */
export const connectTwilio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subAccountId: string;
    accountSid: string;
    apiKeySid: string;
    apiKeySecret: string;
    friendlyName?: string;
  }) =>
    z.object({
      subAccountId: z.string().uuid(),
      accountSid: z.string().min(30).startsWith("AC"),
      apiKeySid: z.string().min(30).startsWith("SK"),
      apiKeySecret: z.string().min(20),
      friendlyName: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);

    // Verify credentials before saving
    const info = await verifyTwilioCredentials({
      accountSid: data.accountSid,
      apiKeySid: data.apiKeySid,
      apiKeySecret: data.apiKeySecret,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any)
      .from("twilio_connections")
      .select("id, webhook_token")
      .eq("sub_account_id", data.subAccountId)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabaseAdmin as any)
        .from("twilio_connections")
        .update({
          account_sid: data.accountSid,
          api_key_sid: data.apiKeySid,
          api_key_secret: data.apiKeySecret,
          friendly_name: data.friendlyName ?? info.friendlyName,
          status: info.status,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, status: info.status, friendlyName: info.friendlyName };
    }

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("twilio_connections")
      .insert({
        sub_account_id: data.subAccountId,
        account_sid: data.accountSid,
        api_key_sid: data.apiKeySid,
        api_key_secret: data.apiKeySecret,
        friendly_name: data.friendlyName ?? info.friendlyName,
        status: info.status,
        last_verified_at: new Date().toISOString(),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, status: info.status, friendlyName: info.friendlyName };
  });

/** Disconnect (remove) the Twilio connection. Does not release owned numbers. */
export const disconnectTwilio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("twilio_connections")
      .delete()
      .eq("sub_account_id", data.subAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Get the connection summary for the UI. */
export const getTwilioConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("twilio_connections")
      .select("id, account_sid, friendly_name, status, webhook_token, last_verified_at, created_at")
      .eq("sub_account_id", data.subAccountId)
      .maybeSingle();
    if (!row) return { connected: false as const };
    return {
      connected: true as const,
      id: row.id,
      accountSid: row.account_sid,
      friendlyName: row.friendly_name,
      status: row.status,
      lastVerifiedAt: row.last_verified_at,
      webhookVoiceUrl: voiceWebhookUrl(row.webhook_token),
      webhookSmsUrl: smsWebhookUrl(row.webhook_token),
      webhookStatusUrl: statusWebhookUrl(row.webhook_token),
    };
  });

/** Search for available phone numbers on Twilio. */
export const searchNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subAccountId: string;
    isoCountry: string;
    type?: "Local" | "TollFree" | "Mobile";
    areaCode?: string;
    contains?: string;
    smsEnabled?: boolean;
    mmsEnabled?: boolean;
    voiceEnabled?: boolean;
  }) =>
    z.object({
      subAccountId: z.string().uuid(),
      isoCountry: z.string().length(2),
      type: z.enum(["Local", "TollFree", "Mobile"]).optional(),
      areaCode: z.string().optional(),
      contains: z.string().optional(),
      smsEnabled: z.boolean().optional(),
      mmsEnabled: z.boolean().optional(),
      voiceEnabled: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.supabase, context.userId, data.subAccountId);
    const conn = await loadConnection(data.subAccountId);
    const auth = {
      accountSid: conn.account_sid,
      apiKeySid: conn.api_key_sid,
      apiKeySecret: conn.api_key_secret,
    };
    const [numbers, price] = await Promise.all([
      searchAvailableNumbers(auth, {
        isoCountry: data.isoCountry,
        type: data.type,
        areaCode: data.areaCode,
        contains: data.contains,
        smsEnabled: data.smsEnabled,
        mmsEnabled: data.mmsEnabled,
        voiceEnabled: data.voiceEnabled,
        limit: 25,
      }),
      getNumberPrice(auth, data.isoCountry, (data.type ?? "Local").toLowerCase()),
    ]);
    return { numbers, monthlyPrice: price };
  });

/** Purchase a number and store it in twilio_numbers. */
export const buyNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; phoneNumber: string; friendlyName?: string }) =>
    z.object({
      subAccountId: z.string().uuid(),
      phoneNumber: z.string().min(4),
      friendlyName: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);
    const conn = await loadConnection(data.subAccountId);
    const auth = {
      accountSid: conn.account_sid,
      apiKeySid: conn.api_key_sid,
      apiKeySecret: conn.api_key_secret,
    };

    const voiceUrl = voiceWebhookUrl(conn.webhook_token);
    const smsUrl = smsWebhookUrl(conn.webhook_token);
    const statusUrl = statusWebhookUrl(conn.webhook_token);

    const purchased = await purchaseNumber(auth, {
      phoneNumber: data.phoneNumber,
      friendlyName: data.friendlyName ?? data.phoneNumber,
      voiceUrl,
      smsUrl,
      statusCallback: statusUrl,
    });

    // best-effort price lookup
    const price = purchased.isoCountry
      ? await getNumberPrice(auth, purchased.isoCountry).catch(() => null)
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .insert({
        sub_account_id: data.subAccountId,
        connection_id: conn.id,
        phone_number: purchased.phoneNumber,
        friendly_name: purchased.friendlyName,
        twilio_sid: purchased.sid,
        capabilities: purchased.capabilities,
        monthly_cost: price?.monthly ?? null,
        cost_currency: price?.currency ?? null,
        iso_country: purchased.isoCountry,
        voice_url: voiceUrl,
        sms_url: smsUrl,
        status_callback: statusUrl,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, phoneNumber: purchased.phoneNumber };
  });

/** List numbers owned by a sub-account. */
export const listMyNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string }) => z.object({ subAccountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .select("id, phone_number, friendly_name, twilio_sid, capabilities, monthly_cost, cost_currency, iso_country, is_default, purchased_at")
      .eq("sub_account_id", data.subAccountId)
      .is("released_at", null)
      .order("purchased_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Release (delete) a number from Twilio and mark as released locally. */
export const releaseTwilioNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; numberId: string }) =>
    z.object({ subAccountId: z.string().uuid(), numberId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);
    const conn = await loadConnection(data.subAccountId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: numberRow, error: fetchErr } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .select("id, twilio_sid, sub_account_id")
      .eq("id", data.numberId)
      .single();
    if (fetchErr || !numberRow || numberRow.sub_account_id !== data.subAccountId) {
      throw new Error("Number not found");
    }

    await releaseNumber(
      { accountSid: conn.account_sid, apiKeySid: conn.api_key_sid, apiKeySecret: conn.api_key_secret },
      numberRow.twilio_sid,
    );

    const { error: updErr } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .update({ released_at: new Date().toISOString() })
      .eq("id", data.numberId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

/** Rename a number and update Twilio friendly_name. */
export const renameTwilioNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; numberId: string; friendlyName: string }) =>
    z.object({
      subAccountId: z.string().uuid(),
      numberId: z.string().uuid(),
      friendlyName: z.string().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);
    const conn = await loadConnection(data.subAccountId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .select("twilio_sid, sub_account_id")
      .eq("id", data.numberId)
      .single();
    if (!row || row.sub_account_id !== data.subAccountId) throw new Error("Number not found");

    await updateNumberWebhooks(
      { accountSid: conn.account_sid, apiKeySid: conn.api_key_sid, apiKeySecret: conn.api_key_secret },
      row.twilio_sid,
      { friendlyName: data.friendlyName },
    );

    await (supabaseAdmin as any)
      .from("twilio_numbers")
      .update({ friendly_name: data.friendlyName })
      .eq("id", data.numberId);
    return { ok: true };
  });

/** Mark a number as the default for this workspace. */
export const setDefaultTwilioNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subAccountId: string; numberId: string }) =>
    z.object({ subAccountId: z.string().uuid(), numberId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.subAccountId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("twilio_numbers")
      .update({ is_default: false })
      .eq("sub_account_id", data.subAccountId);
    const { error } = await (supabaseAdmin as any)
      .from("twilio_numbers")
      .update({ is_default: true })
      .eq("id", data.numberId)
      .eq("sub_account_id", data.subAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Phase 2: SMS send ============
import { sendMessageWithMedia } from "./twilio.server";

/** Send an SMS/MMS from one of your Twilio numbers into a conversation. */
export const sendTwilioSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subAccountId: string;
    conversationId: string;
    body: string;
    twilioNumberId?: string;
    mediaUrls?: string[];
  }) =>
    z.object({
      subAccountId: z.string().uuid(),
      conversationId: z.string().uuid(),
      body: z.string().min(1).max(1600),
      twilioNumberId: z.string().uuid().optional(),
      mediaUrls: z.array(z.string().url()).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.supabase, context.userId, data.subAccountId);
    const conn = await loadConnection(data.subAccountId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load conversation + contact phone
    const { data: convo, error: convoErr } = await (supabaseAdmin as any)
      .from("conversations")
      .select("id, sub_account_id, contact_id, twilio_number_id, channel")
      .eq("id", data.conversationId)
      .single();
    if (convoErr || !convo || convo.sub_account_id !== data.subAccountId) {
      throw new Error("Conversation not found");
    }

    const { data: contact, error: contactErr } = await (supabaseAdmin as any)
      .from("contacts")
      .select("id, phone")
      .eq("id", convo.contact_id)
      .single();
    if (contactErr || !contact?.phone) throw new Error("Contact has no phone number");

    // Pick the from-number: explicit -> conversation's saved -> default -> first
    const chosenId = data.twilioNumberId ?? convo.twilio_number_id;
    let fromRow: any = null;
    if (chosenId) {
      const { data: r } = await (supabaseAdmin as any)
        .from("twilio_numbers")
        .select("id, phone_number, sub_account_id")
        .eq("id", chosenId)
        .single();
      if (r?.sub_account_id === data.subAccountId) fromRow = r;
    }
    if (!fromRow) {
      const { data: rows } = await (supabaseAdmin as any)
        .from("twilio_numbers")
        .select("id, phone_number, is_default")
        .eq("sub_account_id", data.subAccountId)
        .is("released_at", null)
        .order("is_default", { ascending: false })
        .order("purchased_at", { ascending: false })
        .limit(1);
      fromRow = rows?.[0];
    }
    if (!fromRow) throw new Error("No Twilio numbers available. Buy one in Settings → Phone numbers.");

    // Persist the number on the conversation for future replies
    if (convo.twilio_number_id !== fromRow.id) {
      await (supabaseAdmin as any)
        .from("conversations")
        .update({ twilio_number_id: fromRow.id, channel: "sms" })
        .eq("id", convo.id);
    }

    // Send via Twilio
    const sent = await sendMessageWithMedia(
      { accountSid: conn.account_sid, apiKeySid: conn.api_key_sid, apiKeySecret: conn.api_key_secret },
      {
        from: fromRow.phone_number,
        to: contact.phone,
        body: data.body,
        mediaUrls: data.mediaUrls,
        statusCallback: statusWebhookUrl(conn.webhook_token),
      },
    );

    // Insert outbound message row
    const { data: msg, error: msgErr } = await (supabaseAdmin as any)
      .from("messages")
      .insert({
        conversation_id: convo.id,
        sub_account_id: data.subAccountId,
        author_user_id: context.userId,
        body: data.body,
        channel: "sms",
        direction: "outbound",
        kind: "sms_log",
        external_id: sent.sid,
        from_number: fromRow.phone_number,
        to_number: contact.phone,
        delivery_status: sent.status,
        media_urls: data.mediaUrls ?? [],
        sender_handle: fromRow.phone_number,
      })
      .select("id")
      .single();
    if (msgErr) throw new Error(msgErr.message);
    return { id: msg.id, sid: sent.sid, status: sent.status };
  });
