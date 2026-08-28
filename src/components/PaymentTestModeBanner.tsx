const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

/** Shows the current payment environment. Renders nothing once live. */
export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Live checkout isn't configured yet. Finish payment go-live to charge real cards.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
        Payments are in <span className="font-semibold">test mode</span> — use card{" "}
        <span className="font-mono">4242 4242 4242 4242</span> to try a subscription. No money moves.
      </div>
    );
  }
  return null;
}
