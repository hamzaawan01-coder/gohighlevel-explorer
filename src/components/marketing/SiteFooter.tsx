import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

/** Shared marketing-site footer. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Zap className="size-3.5" />
            </span>
            <span className="font-display text-sm font-bold">Lead Convert</span>
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
            One workspace for capturing leads, talking to them on every channel and booking the
            meeting.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
            <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
            <li><Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Company
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Get started
          </h3>
          <p className="mt-3 text-xs text-muted-foreground">
            See the platform on a live walkthrough with your own pipeline in mind.
          </p>
          <Link
            to="/contact"
            className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Book a demo
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Lead Convert</span>
          <span>Built for teams that answer fast.</span>
        </div>
      </div>
    </footer>
  );
}
