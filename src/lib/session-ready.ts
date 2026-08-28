import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase restores its session from storage asynchronously. Any RPC that is
 * `SECURITY DEFINER` + signed-in-only (`list_agency_members`,
 * `has_subaccount_access`) fails with "permission denied for function" when it
 * fires before that restore finishes. These helpers make the wait explicit.
 */

let pending: Promise<boolean> | null = null;

/** Resolve once auth has finished initialising. `true` when a session exists. */
export function waitForSession(timeoutMs = 8000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (pending) return pending;

  pending = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub?.subscription.unsubscribe();
      // Allow a later re-check (e.g. after sign-out then sign-in).
      pending = null;
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        finish(!!session);
      } else if (event === "SIGNED_OUT") {
        finish(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
    });
  });

  return pending;
}

/**
 * Throws when auth is ready but nobody is signed in, so callers never issue an
 * RPC that is guaranteed to be rejected.
 */
export async function requireSession(): Promise<void> {
  const ok = await waitForSession();
  if (!ok) throw new Error("Not signed in yet");
}

/** Returns `false` until auth has initialised — use it to gate queries and UI. */
export function useSessionReady(): { ready: boolean; authenticated: boolean } {
  const [state, setState] = useState({ ready: false, authenticated: false });

  useEffect(() => {
    let alive = true;
    void waitForSession().then((authenticated) => {
      if (alive) setState({ ready: true, authenticated });
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
