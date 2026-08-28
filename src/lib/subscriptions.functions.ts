import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type SyncResult = { stripePriceId: string } | { error: string };
type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

/**
 * Create (or refresh) the Stripe product + price behind a plan so it can be
 * charged. Safe to call repeatedly — the lookup key is stable per plan.
 */
export const syncPlanToStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<SyncResult> => {
    const { supabase } = context;
    const { data: plan, error } = await supabase
      .from("subscription_plans")
      .select("id, name, description, price_cents, currency, billing_interval, stripe_price_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (error || !plan) return { error: "Plan not found" };

    try {
      const stripe = createStripeClient(data.environment);
      const lookupKey = `plan_${plan.id.replace(/-/g, "")}`;

      const products = await stripe.products.search({
        query: `metadata['lovable_external_id']:'${lookupKey}'`,
        limit: 1,
      });
      const product = products.data[0]
        ? await stripe.products.update(products.data[0].id, {
            name: plan.name,
            description: plan.description || undefined,
          })
        : await stripe.products.create({
            name: plan.name,
            description: plan.description || undefined,
            tax_code: "txcd_10103001", // SaaS — electronically supplied services
            metadata: { lovable_external_id: lookupKey },
          });

      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      const match = existing.data[0];
      const unchanged =
        match &&
        match.unit_amount === plan.price_cents &&
        match.currency === plan.currency &&
        match.recurring?.interval === plan.billing_interval;

      const price = unchanged
        ? match
        : await stripe.prices.create({
            product: product.id,
            currency: plan.currency,
            unit_amount: plan.price_cents,
            nickname: plan.name,
            recurring: { interval: plan.billing_interval as "month" | "year" },
            lookup_key: lookupKey,
            transfer_lookup_key: true,
          });

      if (plan.stripe_price_id !== lookupKey) {
        await supabase
          .from("subscription_plans")
          .update({ stripe_price_id: lookupKey })
          .eq("id", plan.id);
      }

      return { stripePriceId: price.lookup_key ?? lookupKey };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Start an embedded subscription checkout for a plan on one workspace. */
export const createPlanCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      planId: string;
      subAccountId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id, name, stripe_price_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan?.stripe_price_id) {
      return { error: "This plan is not connected to payments yet. Sync it first." };
    }

    // RLS: reading the workspace proves the caller can act on it.
    const { data: workspace } = await supabase
      .from("sub_accounts")
      .select("id, name")
      .eq("id", data.subAccountId)
      .maybeSingle();
    if (!workspace) return { error: "Workspace not found" };

    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [plan.stripe_price_id], limit: 1 });
      const price = prices.data[0];
      if (!price) return { error: "Price not found in payments — re-sync the plan." };

      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? undefined;

      let customerId: string | undefined;
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data[0]) {
        customerId = found.data[0].id;
      } else if (email) {
        const byEmail = await stripe.customers.list({ email, limit: 1 });
        if (byEmail.data[0]) {
          customerId = byEmail.data[0].id;
          if (byEmail.data[0].metadata?.['userId'] !== userId) {
            await stripe.customers.update(customerId, {
              metadata: { ...byEmail.data[0].metadata, userId },
            });
          }
        }
      }
      if (!customerId) {
        const created = await stripe.customers.create({
          ...(email && { email }),
          metadata: { userId },
        });
        customerId = created.id;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: {
          userId,
          subAccountId: data.subAccountId,
          planId: plan.id,
          managed_payments: "true",
        },
        subscription_data: {
          metadata: { userId, subAccountId: data.subAccountId, planId: plan.id },
        },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Open the hosted billing portal for a workspace's subscription. */
export const createSubscriptionPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { subAccountId: string; returnUrl?: string; environment: StripeEnv }) => data,
  )
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase } = context;
    const { data: sub } = await supabase
      .from("sub_account_subscriptions")
      .select("stripe_customer_id")
      .eq("sub_account_id", data.subAccountId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { error: "No billing account for this workspace yet." };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
