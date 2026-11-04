"use client";

import { RotateCcw, Store, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/research/bits";
import { guidedStep } from "@/lib/journey/machine";
import { type Perspective, useCrossTabSync, useJourney } from "@/lib/journey/store";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { AndrewWorkspace } from "./AndrewWorkspace";
import { CustomerExperience } from "./CustomerExperience";

const STORY: [string, Perspective][] = [
  ["Open the client experience", "customer"],
  ["Complete the interest card", "customer"],
  ["Choose style preferences", "customer"],
  ["Request a consultation", "customer"],
  ["Switch to Andrew's workspace", "andrew"],
  ["See the inquiry organized", "andrew"],
  ["Generate the preparation brief", "andrew"],
  ["Approve & prepare a response", "andrew"],
  ["See the update in the portal", "customer"],
  ["Advance the order milestones", "andrew"],
  ["The client returns", "customer"],
];

function PerspectiveSwitch() {
  const perspective = useJourney((s) => s.perspective);
  const setPerspective = useJourney((s) => s.setPerspective);
  const hasNew = useJourney((s) => Boolean(s.journey.interest && !s.journey.viewedByAndrew));
  return (
    <div role="tablist" aria-label="Perspective" className="flex rounded-full border border-hairline bg-raised p-[3px] shadow-card">
      {(
        [
          ["customer", "Client view", User],
          ["andrew", "Andrew's workspace", Store],
        ] as const
      ).map(([p, label, Icon]) => (
        <button
          key={p}
          role="tab"
          aria-selected={perspective === p}
          onClick={() => setPerspective(p)}
          data-testid={`perspective-${p}`}
          className={cn(
            "relative flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] transition-colors duration-200",
            perspective === p ? "bg-navy text-paper" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
          {p === "andrew" && hasNew && perspective !== "andrew" && (
            <span className="rounded-full bg-brass px-1.5 text-[10px] text-raised" data-testid="new-inquiry-badge">
              New inquiry
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function GuidedStory() {
  const step = useJourney((s) => guidedStep(s.journey));
  const setPerspective = useJourney((s) => s.setPerspective);
  return (
    <details className="group rounded-[4px] border border-hairline bg-raised/70 px-4 py-3" open>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] text-ink-soft">
        <span>
          <span className="eyebrow mr-2">Guided demo</span>Step {step} of {STORY.length}: <span className="text-ink">{STORY[step - 1][0]}</span>
        </span>
        <span className="text-faint group-open:hidden">Show</span>
      </summary>
      <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Demo story">
        {STORY.map(([label, p], i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setPerspective(p)}
              aria-current={i + 1 === step ? "step" : undefined}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                i + 1 < step && "border-transparent bg-sunk text-ink-soft",
                i + 1 === step && "border-brass bg-brass-wash text-ink",
                i + 1 > step && "border-hairline text-faint",
              )}
              title={p === "customer" ? "Client view" : "Andrew's workspace"}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function JourneyWorkspace() {
  useCrossTabSync();
  const perspective = useJourney((s) => s.perspective);
  const reset = useJourney((s) => s.reset);
  const mode = useDesk((s) => s.mode);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace IV"
        title="Client Journey"
        lede="From interest card to consultation, order and the continuing relationship — the client's experience and Andrew's workspace, connected. Andrew approves every step."
        step={perspective === "andrew" ? "Decide" : "Observe"}
        aside={
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Reset the client journey to the beginning? Research data is not affected.")) reset();
            }}
            data-testid="reset-journey"
          >
            <RotateCcw /> Reset journey
          </Button>
        }
      />

      <div
        className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[3px] border border-dashed border-brass/50 px-4 py-2.5 text-[12px] text-ink-soft"
        data-testid="journey-simulated-banner"
      >
        <Badge tone="brass">Simulated client journey</Badge>
        <span>
          Fictional customer and transactions. Appointments, deposits, production and messages are not real
          {mode === "live" ? " — even in Live Mode. Only the AI preparation brief uses a live model." : ". Demo Mode uses sample AI responses."}
        </span>
        <span className="text-muted">Saved in this browser only.</span>
      </div>

      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <PerspectiveSwitch />
      </div>
      <div className="mb-8">
        <GuidedStory />
      </div>

      <div key={perspective} className="animate-rise">
        {perspective === "customer" ? <CustomerExperience /> : <AndrewWorkspace />}
      </div>
    </div>
  );
}
