
## Step 1 — Create your Meta App (you do this, ~10 minutes)

Before I write code, do this so I have the App ID + Secret to wire up:

1. Go to https://developers.facebook.com/apps → **Create App** → type **Business** → give it a name (e.g. "GoHighLevel Explorer").
2. In **App settings → Basic**, copy the **App ID** and click **Show** on **App Secret**.
3. In **App settings → Basic → Add Platform → Website**, set site URL to `https://gohighlevel-explorer.lovable.app`.
4. **Add these products** from the left sidebar:
   - Facebook Login for Business
   - Marketing API
   - Messenger
   - Instagram (Instagram Graph API)
   - Webhooks
5. Under **Facebook Login for Business → Settings**, add these **Valid OAuth Redirect URIs**:
   - `https://gohighlevel-explorer.lovable.app/api/public/oauth.meta.callback`
   - `https://id-preview--6f2df40d-8f6c-4778-afb5-36698fa9ad31.lovable.app/api/public/oauth.meta.callback` (for preview testing)
6. Under **App Roles → Roles**, add your Facebook account as a **Tester** so you can use it before Meta approves permissions.
7. Under **App Review → Permissions and Features**, request (later, when ready to go live):
   - `ads_read`, `ads_management`, `leads_retrieval`
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`, `pages_manage_ads`
   - `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`
   - Business Verification is required for the advanced scopes.
8. Come back and tell me you're done — I'll ask for the App ID + Secret via the secure form.

## Step 2 — What I'll build (all in one pass, ~12 files)

### Database (1 migration)
- `meta_connections` table: `sub_account_id`, `meta_user_id`, `access_token` (long-lived), `token_expires_at`, `granted_scopes[]`, timestamps. RLS scoped by sub-account.
- `meta_pages` table: connected FB Pages / IG Business Accounts per connection, with per-page `page_access_token`, `webhook_subscribed`, `instagram_business_account_id`.
- `meta_ad_accounts` table: linked ad accounts (`act_...`), currency, timezone.
- Extend `contacts` with `meta_lead_id` (unique per sub-account) so we don't duplicate leads.
- Extend `messages` / `conversations` to accept `channel = 'messenger'` / `'instagram'` with `external_message_id`.
- All tables: `GRANT` block + RLS policies via `has_subaccount_access`.

### Server code
- `src/lib/meta.server.ts` — Graph API helpers: token exchange (short → long-lived), page token fetch, subscribe page to webhooks, `GET /me/adaccounts`, `GET /{ad_account}/insights`, `POST /{page}/messages`, `GET /{form}/leads`. All wrapped with typed errors.
- `src/lib/meta.functions.ts` — `createServerFn` wrappers used by the UI: `startMetaOAuth`, `listMetaPages`, `linkMetaPage`, `unlinkMetaConnection`, `fetchMetaAdInsights`, `sendMetaMessage`, `listMetaLeadForms`, `subscribeMetaLeadForm`.
- `src/routes/api/public/oauth.meta.callback.ts` — OAuth code-exchange route. Verifies `state` (HMAC-signed with `META_APP_SECRET`), exchanges code for long-lived token, stores in `meta_connections`, redirects to `/settings/integrations?meta=connected`.
- `src/routes/api/public/hooks/meta.$token.ts` — single webhook endpoint for all three products. Handles `GET` challenge verification (`hub.challenge`), verifies `X-Hub-Signature-256` HMAC on `POST`, dispatches by `object` field:
  - `object: page` → messenger messages → insert into `messages` + upsert conversation.
  - `object: instagram` → IG DMs → same conversation table with `channel: 'instagram'`.
  - `object: page` + `field: leadgen` → fetch lead via Graph API, upsert `contacts` with `meta_lead_id`, fire existing `form.submitted` workflow trigger.
- `src/lib/meta-webhook-secret.ts` — deterministic per-sub-account webhook verify token so Meta's URL is stable.

### UI
- New tab in `src/routes/_authenticated/settings.integrations.tsx` → **Meta** (alongside Email / SMS). Shows:
  - "Connect Facebook" button → opens `startMetaOAuth` → redirects to Facebook.
  - Once connected: list of Pages/IG accounts with per-page toggles for "Sync leads", "Route Messenger to inbox", "Route Instagram DMs to inbox".
  - List of ad accounts with a "Use for Reports" checkbox.
  - Webhook callback URL + verify token displayed so you can paste them into Meta's Webhooks product UI (Meta requires you to add the callback URL there manually per product).
- `src/components/MetaConnectPanel.tsx` extracted for the tab body.
- `src/routes/_authenticated/reports.tsx` gets a "Meta Ads spend" widget when at least one ad account is linked (server-side fetch of last-30-day insights).
- `src/routes/_authenticated/conversations.tsx` — Messenger/IG channel filter chips + provider badges on messages; send-reply path routes to `sendMetaMessage` when `conversation.channel === 'messenger' | 'instagram'`.

### Secrets
- `META_APP_ID` (public — I'll store via `set_secret` once you give it to me; it's also fine as `VITE_META_APP_ID` for the OAuth redirect).
- `META_APP_SECRET` (via `add_secret` secure form).
- `META_WEBHOOK_VERIFY_TOKEN` (I'll generate via `generate_secret`).

## Step 3 — After the build

- Immediately usable by you as a Tester (connect flow, page listing, sending a Messenger reply to yourself).
- Lead Ads, ad insights, and Instagram DMs will start populating once Meta approves the corresponding permission — no further code changes needed.

---

**Reply "done" with your App ID when you've finished Step 1** (or ask me any question about the Meta setup) and I'll kick off Step 2 in one go.
