/**
 * Side effects fired the first time a workspace subscription becomes live:
 *  - a welcome email queued to the workspace owner (sent by the outbound queue)
 *  - an in-app notification for the agency owner ("new paid signup")
 *
 * Kept separate from the webhook route so it stays testable and so a failure
 * here can never stop Stripe's event from being acknowledged.
 */

const ACTIVE = ["active", "trialing", "past_due"];

export function isLiveStatus(status: string | null | undefined): boolean {
  return !!status && ACTIVE.includes(status);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function welcomeEmail(workspaceName: string, planName: string | null, appUrl: string) {
  const plan = planName ? ` on the ${planName} plan` : "";
  const subject = `Welcome to Lead Convert${plan ? ` — ${planName}` : ""}`;
  const text = [
    `Hi,`,
    ``,
    `Thanks for subscribing${plan}. Your workspace "${workspaceName}" is set up and your payment went through.`,
    ``,
    `We review new paid signups before switching everything on — you will get a second email the moment your account is approved (usually within a few hours).`,
    ``,
    `Sign in any time: ${appUrl}`,
    ``,
    `— Lead Convert`,
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Welcome to Lead Convert</h2>
      <p>Thanks for subscribing${plan}. Your workspace <strong>${workspaceName}</strong> is set up and your payment went through.</p>
      <p>We review new paid signups before switching everything on — you will get a second email the moment your account is approved (usually within a few hours).</p>
      <p><a href="${appUrl}" style="color:#2563eb">Sign in to your CRM</a></p>
      <p style="color:#666">— Lead Convert</p>
    </div>`;
  return { subject, text, html };
}

/**
 * Called once per workspace when its subscription first goes live.
 * `supabase` must be a service-role client.
 */
export async function notifySubscriptionActivated(
  supabase: any,
  input: { subAccountId: string; planId?: string | null; appUrl?: string },
): Promise<{ emailQueued: boolean; notified: boolean }> {
  const appUrl = input.appUrl || "https://leadsconvert.co.uk";
  let emailQueued = false;
  let notified = false;

  const { data: workspace } = await supabase
    .from("sub_accounts")
    .select("id, name, support_email, agency_id")
    .eq("id", input.subAccountId)
    .maybeSingle();
  if (!workspace) return { emailQueued, notified };

  let planName: string | null = null;
  if (input.planId) {
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("name")
      .eq("id", input.planId)
      .maybeSingle();
    planName = (plan?.name as string | undefined) ?? null;
  }

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, owner_user_id")
    .eq("id", workspace.agency_id)
    .maybeSingle();

  // Owner's email: workspace support address first, otherwise the account email.
  let to: string | null = (workspace.support_email as string | null) || null;
  if (!to && agency?.owner_user_id) {
    try {
      const { data } = await supabase.auth.admin.getUserById(agency.owner_user_id);
      to = (data?.user?.email as string | undefined) ?? null;
    } catch {
      to = null;
    }
  }

  if (to) {
    const mail = welcomeEmail(workspace.name as string, planName, appUrl);
    const { error } = await supabase.from("outbound_messages").insert({
      sub_account_id: workspace.id,
      channel: "email",
      to_address: to,
      subject: mail.subject,
      body_text: mail.text,
      body_html: mail.html,
      send_after_quiet_hours: false,
    });
    emailQueued = !error;
  }

  if (agency?.owner_user_id) {
    const { error } = await supabase.from("notifications").insert({
      user_id: agency.owner_user_id,
      sub_account_id: workspace.id,
      title: "New paid signup",
      body: `${workspace.name}${planName ? ` subscribed to ${planName}` : " started a subscription"} — approve the account to unlock their modules.`,
      link: "/settings/signups",
    });
    notified = !error;
  }

  return { emailQueued, notified };
}
