import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPlanCheckoutSession } from "@/lib/subscriptions.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planName?: string;
  subAccountId: string | null;
};

/** Inline (embedded) subscription checkout for one plan + workspace. */
export function PlanCheckoutDialog({ open, onOpenChange, planId, planName, subAccountId }: Props) {
  const ready = open && !!planId && !!subAccountId;

  const fetchClientSecret = async (): Promise<string> => {
    const result = await createPlanCheckoutSession({
      data: {
        planId: planId!,
        subAccountId: subAccountId!,
        returnUrl: `${window.location.origin}/settings/subscriptions?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started");
    return result.clientSecret;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscribe{planName ? ` — ${planName}` : ""}</DialogTitle>
        </DialogHeader>
        {ready ? (
          <div id="checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
