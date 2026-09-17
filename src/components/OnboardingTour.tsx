import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Compass, FileDown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "agency-engine.tour.v1";

type Step = {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  linkLabel?: string;
};

const STEPS: Step[] = [
  {
    title: "Start on the Dashboard",
    body: "Pipeline value, deals won this month, tasks due and the newest activity all live here. It's the fastest way to see whether today needs attention.",
    icon: LayoutDashboard,
    to: "/dashboard",
    linkLabel: "Open Dashboard",
  },
  {
    title: "Explore every module",
    body: "The Module Explorer lists every module in your workspace with its category and whether it's covered in your build. Search or filter to find CRM, pipelines, messaging or campaigns instantly.",
    icon: Compass,
    to: "/modules-explorer",
    linkLabel: "Open Module Explorer",
  },
  {
    title: "Export the All Modules report",
    body: "From the Module Explorer, use Export CSV for spreadsheets or Export PDF to print/save a formatted report — including where each piece of information came from.",
    icon: FileDown,
    to: "/modules-explorer",
    linkLabel: "Go export a report",
  },
];

export function hasSeenTour() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return true;
  }
}

export function restartTour() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("tour:restart"));
}

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasSeenTour()) setOpen(true);
    const onRestart = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("tour:restart", onRestart);
    return () => window.removeEventListener("tour:restart", onRestart);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function finish() {
    try {
      localStorage.setItem(KEY, "done");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  const current = STEPS[step]!;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/25 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Getting started tour"
        className="surface-card elevation-overlay w-full max-w-md p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <p className="eyebrow flex items-center gap-1">
                <Sparkles className="size-3" /> Getting started
              </p>
              <p className="text-[11px] text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Skip tour"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="font-display text-base font-bold">{current.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {current.to && (
              <Button asChild variant="outline" size="sm" onClick={last ? finish : undefined}>
                <Link to={current.to}>{current.linkLabel}</Link>
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={finish}>
                Done
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
