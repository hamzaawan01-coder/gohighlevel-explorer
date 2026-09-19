// Browser softphone — floating widget that lets any workspace member place and
// receive Twilio Voice calls right in the CRM.
import { useEffect, useRef, useState } from "react";
import type { Device as DeviceType, Call } from "@twilio/voice-sdk";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenancy } from "@/lib/tenancy";
import { getVoiceToken, listMyNumbers, getTwilioConnection } from "@/lib/twilio.functions";
import { setSoftphoneState } from "@/lib/softphone-bus";
import { toast } from "sonner";

export function Softphone() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const fetchToken = useServerFn(getVoiceToken);
  const listNumbers = useServerFn(listMyNumbers);
  const getConn = useServerFn(getTwilioConnection);

  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<DeviceType | null>(null);
  const [status, setStatus] = useState<"idle" | "registering" | "ready" | "error">("idle");
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [callState, setCallState] = useState<"idle" | "dialing" | "in-call" | "ringing">("idle");
  const [muted, setMuted] = useState(false);
  const [dialTo, setDialTo] = useState("");
  const [fromId, setFromId] = useState<string>("");
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  const conn = useQuery({
    queryKey: ["twilio-conn", subId],
    queryFn: () => getConn({ data: { subAccountId: subId! } }),
    enabled: !!subId,
  });
  const numbers = useQuery({
    queryKey: ["twilio-numbers", subId],
    queryFn: () => listNumbers({ data: { subAccountId: subId! } }),
    enabled: !!subId && !!conn.data && conn.data.connected,
  });

  useEffect(() => {
    if (!numbers.data?.length) return;
    if (!fromId) {
      const def = numbers.data.find((n: any) => n.is_default) ?? numbers.data[0];
      setFromId(def.id);
    }
  }, [numbers.data, fromId]);

  // Initialize device on demand
  const initDevice = async () => {
    if (device || !subId) return;
    setStatus("registering");
    try {
      const { token } = await fetchToken({ data: { subAccountId: subId } });
      const Device = await loadTwilioDevice();
      const d = new Device(token, { logLevel: 1, codecPreferences: ["opus" as any, "pcmu" as any] });
      d.on("registered", () => setStatus("ready"));
      d.on("error", (e: any) => {
        console.error("Twilio device error", e);
        toast.error(`Softphone: ${e.message ?? "error"}`);
        setStatus("error");
      });
      d.on("incoming", (call: Call) => {
        setIncoming(call);
        setCallState("ringing");
        call.on("cancel", () => { setIncoming(null); setCallState("idle"); });
        call.on("disconnect", () => { setIncoming(null); setActiveCall(null); setCallState("idle"); });
      });
      d.on("tokenWillExpire", async () => {
        try {
          const t = await fetchToken({ data: { subAccountId: subId } });
          d.updateToken(t.token);
        } catch {}
      });
      await d.register();
      setDevice(d);
    } catch (e: any) {
      toast.error(`Softphone init failed: ${e.message ?? e}`);
      setStatus("error");
    }
  };

  useEffect(() => {
    return () => {
      device?.destroy();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (callState === "in-call") {
      setCallSeconds(0);
      timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [callState]);

  // Register with Twilio as soon as the workspace has a connection so inbound
  // calls ring even when the dialer panel is closed.
  useEffect(() => {
    if (conn.data?.connected && !device && status === "idle") void initDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.data?.connected, device, status]);

  const dial = async () => {
    if (!device || !dialTo || !fromId) return;
    try {
      const call = await device.connect({ params: { To: dialTo, FromNumberId: fromId } });
      setActiveCall(call);
      setCallState("dialing");
      call.on("accept", () => setCallState("in-call"));
      call.on("disconnect", () => { setActiveCall(null); setCallState("idle"); setMuted(false); });
      call.on("cancel", () => { setActiveCall(null); setCallState("idle"); });
      call.on("error", (e: any) => toast.error(`Call error: ${e.message}`));
    } catch (e: any) {
      toast.error(`Dial failed: ${e.message ?? e}`);
    }
  };

  const answer = () => {
    if (!incoming) return;
    incoming.accept();
    setActiveCall(incoming);
    setIncoming(null);
    setCallState("in-call");
  };
  const reject = () => { incoming?.reject(); setIncoming(null); setCallState("idle"); };
  const hangup = () => { activeCall?.disconnect(); setActiveCall(null); setCallState("idle"); setMuted(false); };
  const toggleMute = () => {
    if (!activeCall) return;
    const next = !muted;
    activeCall.mute(next);
    setMuted(next);
  };

  // Publish call state so other screens (Inbox) can answer from their own UI.
  useEffect(() => {
    const fromNumber =
      (incoming?.parameters.From as string | undefined) ??
      (activeCall?.parameters.From as string | undefined) ??
      (activeCall?.parameters.To as string | undefined) ??
      (callState === "dialing" ? dialTo : null) ??
      null;
    setSoftphoneState({
      callState,
      from: fromNumber,
      answer: incoming ? answer : null,
      reject: incoming ? reject : null,
      hangup: activeCall ? hangup : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, incoming, activeCall, dialTo]);

  if (!subId || !conn.data?.connected) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); if (!device) initDevice(); }}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition"
          aria-label="Open dialer"
        >
          {callState === "ringing" ? <PhoneIncoming className="h-6 w-6 animate-pulse" /> : <Phone className="h-6 w-6" />}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold">Softphone</div>
                <div className="text-xs text-muted-foreground">
                  {status === "ready" ? "Ready" : status === "registering" ? "Connecting…" : status === "error" ? "Offline" : "Idle"}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Incoming call */}
            {callState === "ringing" && incoming && (
              <div className="text-center space-y-3">
                <div className="text-sm text-muted-foreground">Incoming</div>
                <div className="text-lg font-semibold">{incoming.parameters.From ?? "Unknown"}</div>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={answer} className="bg-green-600 hover:bg-green-700">
                    <Phone className="h-4 w-4 mr-1" /> Answer
                  </Button>
                  <Button size="sm" variant="destructive" onClick={reject}>
                    <PhoneOff className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            )}

            {/* In-call */}
            {callState === "in-call" && (
              <div className="text-center space-y-3">
                <div className="text-lg font-semibold">{formatDuration(callSeconds)}</div>
                <div className="text-sm text-muted-foreground">
                  {activeCall?.parameters.To ?? activeCall?.parameters.From ?? "In call"}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant={muted ? "default" : "outline"} onClick={toggleMute}>
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={hangup}>
                    <PhoneOff className="h-4 w-4 mr-1" /> Hang up
                  </Button>
                </div>
              </div>
            )}

            {callState === "dialing" && (
              <div className="text-center space-y-3">
                <div className="text-sm text-muted-foreground animate-pulse">Dialing…</div>
                <div className="text-lg font-semibold">{dialTo}</div>
                <Button size="sm" variant="destructive" onClick={hangup}>
                  <PhoneOff className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            )}

            {/* Idle: dial pad */}
            {callState === "idle" && (
              <>
                {numbers.data && numbers.data.length > 0 ? (
                  <Select value={fromId} onValueChange={setFromId}>
                    <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                    <SelectContent>
                      {numbers.data.map((n: any) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.friendly_name} · {n.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-muted-foreground">Buy a number in Settings → Phone numbers first.</div>
                )}
                <Input
                  placeholder="+15551234567"
                  value={dialTo}
                  onChange={(e) => setDialTo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") dial(); }}
                />
                <Button className="w-full" onClick={dial} disabled={status !== "ready" || !dialTo || !fromId}>
                  <Phone className="h-4 w-4 mr-2" /> Call
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// The SDK's ESM build extends Node's EventEmitter, which doesn't exist in the
// browser ("Class extends value undefined"). The prebuilt dist bundle is
// self-contained UMD and exposes window.Twilio.Device, so use that instead.
let devicePromise: Promise<typeof DeviceType> | null = null;
function loadTwilioDevice(): Promise<typeof DeviceType> {
  if (!devicePromise) {
    devicePromise = import("@twilio/voice-sdk/dist/twilio.min.js").then(() => {
      const Device = (window as any).Twilio?.Device;
      if (!Device) throw new Error("Twilio voice library failed to load");
      return Device;
    });
  }
  return devicePromise;
}
