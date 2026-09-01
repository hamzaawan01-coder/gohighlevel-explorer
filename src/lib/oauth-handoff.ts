/**
 * Facebook (and most OAuth providers) refuse to render inside an iframe, so a
 * same-tab `location.assign` from the Lovable preview iframe produces a blank
 * "snap" with nothing on screen. This helper opens the provider in a real
 * top-level context instead.
 *
 * Usage: call `beginOAuthHandoff()` synchronously in the click handler (so the
 * user gesture is still active and the popup is not blocked), then call the
 * returned `complete(url)` once the server hands back the authorize URL.
 */
export function beginOAuthHandoff(): (url: string) => void {
  const framed = typeof window !== "undefined" && window.top !== window.self;

  // Only pre-open a tab when we are framed; a top-level page navigates itself.
  const pending = framed ? window.open("about:blank", "_blank") : null;

  return (url: string) => {
    if (pending && !pending.closed) {
      pending.location.href = url;
      pending.focus?.();
      return;
    }
    if (framed) {
      // Popup blocked — try to escape the frame, then fall back to a new tab.
      try {
        if (window.top) {
          window.top.location.href = url;
          return;
        }
      } catch {
        /* cross-origin parent — cannot navigate it */
      }
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (tab) return;
    }
    window.location.assign(url);
  };
}
