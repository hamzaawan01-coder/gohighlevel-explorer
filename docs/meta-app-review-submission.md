# Meta App Review submission — Lead Convert CRM

App: highlevel Explorer (ID 1605512107846506) · Live mode
Domain: https://leadsconvert.co.uk

## 0. Before you submit

1. **Remove permissions you don't use.** The CRM sends WhatsApp through Twilio, not Meta.
   In App Review → Permissions and Features, **withdraw/cancel `whatsapp_business_messaging`**
   (a rejected request you don't need keeps failing reviews).
2. `public_profile` needs no review — it is granted by default. If it shows as rejected,
   it is because it was bundled into a rejected submission; just don't resubmit it.
3. `email` is not requested by the CRM (it is opt-in via `META_EXTRA_SCOPES`), so leave it out.
4. Complete Business Verification (Business Settings → Security Centre) — most rejections
   are actually "business not verified".
5. Confirm URLs in App settings → Basic:
   - Privacy Policy: https://leadsconvert.co.uk/privacy
   - Terms of Service: https://leadsconvert.co.uk/terms
   - Data Deletion Callback: https://leadsconvert.co.uk/api/public/meta/data-deletion
   - App Domains: leadsconvert.co.uk
   - OAuth redirect URI: https://leadsconvert.co.uk/api/public/oauth/meta/callback

## 1. Permissions to request (Advanced Access)

| Permission | Why we need it (paste into "How will you use this permission?") |
| --- | --- |
| `pages_show_list` | After a business owner logs in, we list the Facebook Pages they manage so they can choose which Page to connect to their CRM workspace. Without it we cannot show a Page picker. |
| `pages_read_engagement` | We read basic Page metadata (name, category, linked Instagram account) to label the connected Page inside the CRM and to resolve which workspace an incoming message belongs to. |
| `pages_manage_metadata` | We subscribe the connected Page to our webhook so new Messenger messages and Lead Ad submissions are delivered to the CRM in real time, and unsubscribe it when the user disconnects. |
| `pages_messaging` | The CRM is a shared team inbox. We receive Messenger conversations from the connected Page and send the business's own replies from the CRM inbox, within Meta's 24-hour messaging window. |
| `leads_retrieval` | We retrieve Lead Ad form submissions for the connected Page so each lead becomes a contact and an opportunity in the business's pipeline, including historical leads on first connect. |
| `ads_read` | We read ad account, campaign, ad set and ad spend data to build the attribution and ad ROI reports that match CRM revenue back to the ads that produced it. |
| `ads_management` | We read ad account structure and lead-form configuration for the connected ad accounts so form-to-pipeline routing stays accurate. (Request only if the reviewer asks; drop it if you never create/edit ads from the CRM.) |
| `business_management` | We list the Business Manager assets (Pages, ad accounts) the logged-in user has access to, so they only connect assets they actually own. |
| `instagram_basic` | We resolve the Instagram professional account linked to the connected Page so its DMs appear in the CRM inbox with the correct account label. |
| `instagram_manage_messages` | We receive Instagram DMs for the connected professional account and send the business's replies from the CRM inbox. |

## 2. Screencast script (one video, 3–5 minutes, English, screen + narration)

Record on the live domain, signed in as the reviewer test account.

1. Show https://leadsconvert.co.uk — say it is a CRM for small businesses.
2. Log in with the reviewer test credentials.
3. Go to **Settings → Integrations → Meta**. Say: "The business owner connects their own Facebook assets here."
4. Click **Connect Facebook**. Show the Facebook consent screen and the permissions being requested. Grant them.
5. Back in the CRM, show the connected Page list and click **Enable all pages** (this is `pages_manage_metadata` subscribing the webhook).
6. Send a Messenger DM to the connected Page from a second device/account. Show it arriving in **Inbox**, then **type a reply and send it** (this demonstrates `pages_messaging`).
7. Repeat briefly with an Instagram DM (`instagram_basic`, `instagram_manage_messages`).
8. Submit a test Lead Ad form; show the lead landing in **Opportunities** and open the lead to show the raw Meta fields (`leads_retrieval`).
9. Open **Attribution** and show ad spend / ROI figures (`ads_read`).
10. Finish in **Settings → Integrations → Meta** and click **Disconnect** to show revocation.

## 3. Reviewer test credentials (fill in and paste into the submission)

```
URL:      https://leadsconvert.co.uk/auth
Email:    reviewer@leadsconvert.co.uk
Password: <set this in the CRM and paste it here>
Steps:    Log in → Settings → Integrations → Meta → Connect Facebook → Enable all pages → Inbox
```

Create this account through normal signup, approve it in **Settings → Paid signups & approvals**,
and make sure the Meta module is enabled for its workspace.

## 4. Data-handling answers reviewers expect

- **What data do you store?** Page ID/name, Page access token, Instagram business account ID,
  ad account IDs, message contents of conversations with the business, and Lead Ad form fields
  (name, email, phone, custom answers).
- **Why?** To operate the shared inbox, create CRM contacts/opportunities, and report attribution.
- **Deletion:** users can disconnect in Settings → Integrations → Meta (tokens and Page rows are
  deleted), and Meta's Data Deletion Callback is implemented at
  `/api/public/meta/data-deletion`, which returns a confirmation code and a status URL at
  `/data-deletion`. Verify both from **Settings → App review** in the CRM before submitting.

## 5. If a permission gets rejected again

Read the reviewer note verbatim — the three usual causes are:
1. The screencast doesn't show the permission actually being used in the product (most common).
2. Business Verification incomplete.
3. Test credentials didn't work, or the reviewer couldn't reach the Meta screen without extra setup.

Fix only what the note names and resubmit that single permission.

## 6. Marketing API Access Tier rejection ("not enough Ads API calls")

Meta's note: *"Our records do not show a sufficient number of Ads API calls in the
last 15 days by this application."* This is not a wording problem — it is a usage
requirement. Meta wants to see the app actually calling the Marketing API before it
grants the standard access tier.

What we now do about it:
- A scheduled job `sync-meta-ads` runs every 12 hours and calls
  `POST /api/public/hooks/sync-meta-ads`, which reads daily campaign-level insights
  (`/{ad_account_id}/insights`, `level=campaign`, `time_increment=1`) for every
  connected ad account flagged "use for reports", and stores them in `ad_spend_daily`.
- Opening **Attribution → Ad ROI** also issues live insights calls.

Steps to get approved:
1. Publish the site so the endpoint is live at https://leadsconvert.co.uk.
2. Connect at least one real Facebook ad account (Settings → Integrations → Meta → Ads)
   and tick "use for reports". Basic Access to `ads_read` is enough to make these calls.
3. Let the sync run for **15+ consecutive days** (check Attribution → Ad ROI shows
   daily spend rows accumulating).
4. Then hit **Request again** on the Marketing API Access Tier submission with the
   same justification text.

Note: the Access Tier is **not** required for lead capture. Lead Ads work with
`leads_retrieval` + `pages_*`; you only need the tier for high-volume, multi-tenant
ads reporting. If you don't want to wait, withdraw the tier request and ship without it.
