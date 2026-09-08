# Client mailboxes: read and reply from their own address

## Answer to your question first

You do **not** need to build a domain-connection system for each client. There are only three real ways a client's email can live inside the CRM, and two of them need nothing from you:

1. **Their mail is on Google (Gmail or Google Workspace)** — they click Connect, sign in with their own account, and everything is genuinely theirs: their folders, their address, replies leave from their own domain. This is the best experience and needs no DNS work at all.
2. **Their mail is on Microsoft 365 / Outlook** — same as above. The CRM side is already built; the Microsoft sign-in app still needs to be set up once (one approval step, then it works for every client).
3. **Any other host (Hostinger, cPanel, Zoho, Fastmail...)** — those hosts give no sign-in access, so the client forwards a copy of incoming mail into the CRM. They can read and reply. Replies carry their address as the reply-to, so the customer's answer goes straight back to their real inbox.

The one thing option 3 cannot do today is show the client's own domain as the *visible sender*. Doing that per client would mean verifying every client's domain for sending, which means DNS records at each client's registrar — a large, fragile support burden. Recommendation: steer clients to options 1 and 2 wherever possible, keep option 3 as the fallback.

## What is blocking things right now

- No client mailbox has been saved yet, so nothing has been received or sent.
- Sending from the CRM is waiting on the DNS records for the CRM's own sending domain. Until that finishes, replies cannot leave. This needs records added at the registrar for leadsconvert.co.uk.
- Inbound mail today arrives only if the client sets up a forwarding rule at their host. There is no automatic receiving service yet.

## Plan

### 1. Finish the sending domain
Add the DNS records for the CRM's sending domain so outbound replies actually leave. Then verify a real reply reaches an outside inbox.

### 2. Turn on automatic receiving
Add a proper inbound mail service so forwarded mail is parsed reliably (including attachments) instead of depending on whatever format the host sends. This needs a receiving subdomain with MX records pointing at the inbound service, plus its signing secret stored in the CRM. Each client then gets a private delivery address on that subdomain, which is far easier for them than pasting a long URL.

### 3. Make client setup self-service
Rework the Mailbox setup screen into three clear choices — Google, Microsoft, Other host — with per-choice instructions written for a non-technical client, a copyable forwarding address, and a live "we've received mail" confirmation so they know it worked.

### 4. Finish Microsoft sign-in
Complete the Microsoft connector so 365 clients get the same true two-way experience as Google clients.

### 5. End-to-end check
For one client mailbox: send a real message in from outside, confirm it appears in the CRM inbox, reply from the CRM, and confirm the reply lands back outside with the correct reply-to.

## Technical notes

- Inbound: new public webhook secured by the inbound service's signature, replacing/augmenting the token-only route, writing into the existing forwarded message tables.
- Attachments: store on the CRM's file storage at receive time so they open inside the CRM instead of being metadata-only.
- Outbound: keep the managed sender with per-mailbox reply-to; add an optional per-client verified sender only if a client explicitly asks and will do their own DNS.
- Threading: match on message-id / in-reply-to as well as subject so replies group correctly.

## Needs your input / action

- Adding the DNS records for the sending domain (I cannot touch your registrar).
- Choosing and creating an account with the inbound mail service, then adding its MX records to a subdomain.
- Approving the Microsoft app setup step when it appears.
