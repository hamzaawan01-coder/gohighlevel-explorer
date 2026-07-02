# Twilio Phone System — GHL-style

Building the equivalent of GHL's phone system is a large feature. I'll ship it in **four phases** so each one is testable end-to-end before moving on. Phases are independent — you can pause after any of them.

## Credentials model (recommended)

**Per sub-account "Bring Your Own Twilio"** — each workspace connects their own Twilio account (Account SID + API Key SID + API Key Secret). Reasons:

- Numbers, calls, SMS, and WhatsApp charges belong to the customer, not you
- Twilio Terms of Service prohibit one account reselling numbers to unrelated businesses without becoming an ISV/subaccount reseller (a heavy compliance path)
- WhatsApp Business sender registration is per-Twilio-account and requires the business's own Meta Business Manager
- Matches how GHL actually does it (customer connects Twilio, or GHL provisions Twilio subaccounts on their master — same UX for us at v1)

I'll wire a "Connect Twilio" flow in **Settings → Integrations** that stores credentials in a new `twilio_connections` table (encrypted at rest via Supabase).

The existing gateway-based `TWILIO_API_KEY` connector stays for platform-wide utilities but is not used for tenant traffic.

---

## Phase 1 — Foundation + Number Marketplace

**Backend**
- `twilio_connections` (sub_account_id, account_sid, api_key_sid, api_key_secret, status, capabilities)
- `twilio_numbers` (sub_account_id, phone_number E.164, friendly_name, sid, capabilities jsonb {voice,sms,mms,fax}, monthly_cost, purchased_at, voice_url, sms_url, status)
- `twilio.server.ts` — signed request helper, `searchAvailableNumbers`, `purchaseNumber`, `releaseNumber`, `updateNumberWebhooks`
- Server fns: `connectTwilio`, `searchNumbers({country, areaCode, contains, capabilities})`, `buyNumber(phoneNumber)`, `releaseNumber(id)`

**UI — new route `/settings/phone-numbers`**
- Connect Twilio card (SID + API Key form; test call to `/v1/Accounts/{sid}.json`)
- Search panel: country dropdown, area code, contains-digits, capability filters → results table with "Buy $X/mo" button + confirm dialog
- Owned numbers table with release / rename / set-default

Auto-configures purchased numbers to point voice/SMS webhooks at `/api/public/twilio/{connection_token}/voice` and `/sms`.

## Phase 2 — SMS / MMS in Conversations

- Extend `conversations` / `messages` to carry `twilio_number_id`, `from_number`, `to_number`, `media_urls[]`, `twilio_message_sid`, `status`
- Inbound webhook `/api/public/twilio/$token/sms.ts`: verify `X-Twilio-Signature`, upsert contact by phone, create/find conversation, insert message, broadcast via Supabase realtime
- Outbound server fn `sendTwilioSms({conversationId, body, mediaUrls})`
- Status callback `/sms-status` updates delivery state
- Conversations UI: number selector (which of your Twilio numbers to send from), MMS attach, delivery ticks

## Phase 3 — Voice (browser dialer + IVR + recordings + voicemail + transcripts)

- **Token endpoint** `getVoiceToken` — mints Twilio Access Token with Voice grant for the logged-in user, scoped to their sub-account's TwiML App
- **TwiML App** auto-created on connect; its Voice URL points to `/api/public/twilio/$token/voice`
- **Voice webhook** returns TwiML that:
  - For inbound calls to a purchased number: checks IVR config → `<Gather>` menu → `<Dial><Client>` to the assigned agent OR `<Record>` voicemail with `transcribe=true`
  - For outbound (from browser): `<Dial callerId=…><Number>{to}</Number></Dial>` with `record="record-from-answer"`
- Tables: `phone_call_flows` (IVR JSON: menu, greeting, business hours, fallback), `phone_calls` (call_sid, direction, from, to, duration, recording_url, transcript, status), `voicemails` (call_id, recording_url, transcription, listened_at)
- Callback handlers: `/voice-status`, `/recording-status`, `/transcription-status`
- **Softphone widget** — floating dialer using `@twilio/voice-sdk` in the browser: dial pad, mute, hold, transfer, incoming ring UI
- **Call flow builder** (simple v1): greeting text, menu options → route to user/number/voicemail, business hours
- Contact page: call button + call history tab with recording player and transcript

## Phase 4 — WhatsApp on the Number

- Extends conversations with `channel = 'whatsapp'` (already partly there from Meta work)
- Sender registration flow: guided form that submits to Twilio's WhatsApp Sender API + shows verification status (requires user's Meta Business Manager ID and display name — Meta approves, 1-3 days)
- Once approved, sender number appears in the same Conversations inbox
- Uses same `sendTwilioSms` code path with `whatsapp:` prefix and 24-hour session/template rules
- Template management screen: list approved WA templates from Twilio Content API, send template messages when outside 24h window

---

## Technical notes (skip if not interested)

- **Webhook security**: every inbound endpoint verifies Twilio's HMAC-SHA1 signature against the full URL + sorted POST params. Per-connection URL token (`$token`) prevents cross-tenant spoofing.
- **Credentials**: stored in `twilio_connections`, read only inside `createServerFn` handlers with `requireSupabaseAuth` + `has_subaccount_access` check. Never sent to the browser except the short-lived Voice access token.
- **Costs surfaced in-app**: number monthly price + per-message/minute pulled from Twilio Pricing API and shown before purchase / on billing dashboard.
- **Recordings** stored on Twilio's S3 and streamed through a signed server fn (never expose Twilio auth to browser).
- Transcriptions use Twilio's built-in `<Record transcribe="true">` for v1; optional upgrade to Deepgram/Whisper via Lovable AI Gateway later.

---

## What I need from you to start

1. **Approve this plan** (or trim phases — e.g. skip WhatsApp for now).
2. Confirm **per-sub-account BYO Twilio** is the right model (vs. one shared Twilio account you own).
3. After approval I'll start with **Phase 1** and stop for you to test buying a number before moving to Phase 2.

Each phase is ~a full build turn on its own. Ready when you are.