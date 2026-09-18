// Tiny shared store so any screen (e.g. the Inbox) can show and answer the
// call that the floating Softphone widget is currently ringing on.
import { useSyncExternalStore } from "react";

export type SoftphoneSnapshot = {
  /** "ringing" when an inbound call is waiting to be answered. */
  callState: "idle" | "dialing" | "in-call" | "ringing";
  /** Caller id of the ringing/active call, when known. */
  from: string | null;
  answer: (() => void) | null;
  reject: (() => void) | null;
  hangup: (() => void) | null;
};

const initial: SoftphoneSnapshot = {
  callState: "idle",
  from: null,
  answer: null,
  reject: null,
  hangup: null,
};

let snapshot: SoftphoneSnapshot = initial;
const listeners = new Set<() => void>();

export function setSoftphoneState(patch: Partial<SoftphoneSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return snapshot;
}

export function useSoftphone(): SoftphoneSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}
