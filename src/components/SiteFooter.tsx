import { Link } from "@tanstack/react-router";

/** Slim legal footer shown across the app and on public pages. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card px-6 py-3 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} Leads Convert</span>
        <Link to="/privacy" className="hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-foreground hover:underline">
          Terms of Service
        </Link>
        <Link to="/data-deletion" className="hover:text-foreground hover:underline">
          Data deletion
        </Link>
      </div>
    </footer>
  );
}
