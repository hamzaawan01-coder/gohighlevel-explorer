
## Multi-tenant model

Two-level tenancy, GHL-style:

```text
Agency (top-level tenant, e.g. "Acme Marketing")
 ├── Sub-account A  (client business "Joe's HVAC")
 ├── Sub-account B  (client business "Bright Dental")
 └── Sub-account C  (client business "City Auto")

Users belong to an Agency, and are granted access to one or many Sub-accounts.
Clients are scoped to a single Sub-account only.
```

### Roles (per scope)

| Role        | Scope               | Can                                                     |
| ----------- | ------------------- | ------------------------------------------------------- |
| `owner`     | Agency              | Everything in the agency, including billing & deletion  |
| `admin`     | Agency              | Manage users, sub-accounts, all data; no billing/delete |
| `member`    | Sub-account(s)      | CRUD CRM data in granted sub-accounts                   |
| `client`    | One sub-account     | Portal only — see own tickets/invoices/appointments     |

### Data tables to add

- `agencies` — name, slug, logo, plan, owner_user_id
- `sub_accounts` — agency_id, name, slug, industry, timezone, archived_at
- `agency_memberships` — agency_id, user_id, role (`owner`/`admin`)
- `sub_account_memberships` — sub_account_id, user_id, role (`member`/`client`)
- `invitations` — email, agency_id, sub_account_id (nullable), role, token, expires_at, accepted_at

### Tables to refactor (add `sub_account_id`)

`contacts`, `deals`, `pipelines`, `pipeline_stages` — every CRM table from now on carries `sub_account_id NOT NULL`. RLS rewrites from `auth.uid() = owner_id` to `has_subaccount_access(auth.uid(), sub_account_id)`.

`owner_id` stays as **assignment** (which staff member owns the record), not as the access gate.

### Security helpers (security definer, prevent RLS recursion)

```sql
has_agency_access(_user uuid, _agency uuid) returns boolean
has_agency_role  (_user uuid, _agency uuid, _role agency_role) returns boolean
has_subaccount_access(_user uuid, _sub uuid) returns boolean
current_agency_id() returns uuid           -- reads agency from a "current" GUC or memberships
```

`has_subaccount_access` returns true if the user is an agency owner/admin of the parent agency **or** has an explicit `sub_account_memberships` row.

### Onboarding flows

1. **Self-serve signup** — creates user → creates a new agency → user becomes `owner` → prompts to create first sub-account.
2. **Invite link** — Owner/Admin generates `invitations` row; recipient hits `/invite/:token`, signs up or signs in, the trigger consumes the token and creates the membership row.

### App-level "current sub-account"

A small `useCurrentSubAccount()` store (Zustand) + a top-bar **sub-account switcher** populated from `sub_account_memberships` (plus all sub-accounts under any agency the user is owner/admin of). All queries filter by `sub_account_id = current`.

### Routes added

- `/onboarding` — first-time agency + sub-account setup
- `/invite/$token` — accept invitation
- `/_authenticated/settings/agency` — agency profile, billing placeholder
- `/_authenticated/settings/team` — invite/manage users, role per sub-account
- `/_authenticated/settings/sub-accounts` — list, create, archive sub-accounts

The existing Dashboard, Contacts, Pipeline pages all gain a `sub_account_id` filter from the active sub-account in context.

### Migration approach

One big migration that:

1. Creates `agencies`, `sub_accounts`, memberships, invitations, role enums, GRANTs, RLS, helper functions.
2. Adds nullable `sub_account_id` to `contacts`, `deals`, `pipelines`, `pipeline_stages`.
3. Backfills: for every existing user with data, creates a default `agency` + default `sub_account`, links them via memberships, sets `sub_account_id` on their existing rows.
4. Sets `sub_account_id NOT NULL`.
5. Drops old `owner_id`-based RLS policies and replaces with `has_subaccount_access`-based policies.
6. Updates `handle_new_user` trigger to also auto-create a personal agency + sub-account (so the existing dashboard keeps working on first login for new sign-ups).

### Code changes (after migration is approved)

- `src/lib/tenancy.ts` — `useCurrentSubAccount` store, `fetchMySubAccounts`, `setCurrentSubAccount`
- `src/components/SubAccountSwitcher.tsx` — top-bar dropdown
- Update `src/lib/pipeline.ts`, `src/lib/contacts.ts` to pass `sub_account_id` on insert and filter on select
- Update `NewDealDialog`, `ContactDialog`, dashboard, contacts page to read current sub-account
- `_authenticated/onboarding.tsx`, `invite.$token.tsx`, `settings.*` routes
- Update `_authenticated/route.tsx` flow: if user has no agency membership → redirect to `/onboarding`

### What stays the same

- Auth provider (Supabase email + Google) — no change.
- All existing UI/components — only their data layer changes.
- The Leads/Tasks/Inbox/etc. modules I port next will be built on this model from day one.

### Out of scope for this step

- Billing / Stripe (placeholder UI only).
- Cross-sub-account reporting (Agency-wide dashboards) — can add later.
- White-labeling per agency (custom domain, branding) — later.

---

After you approve, I'll run the migration first (you'll see it for approval), then push the code changes in the follow-up.
