"use client";

import { useEffect } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IdentityCandidate, ResearchSource } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { BriefView } from "./BriefView";
import { Card, EmptyState, ErrorPanel, PageHeader, SourceChips, UsageLine, type LoopStep } from "./bits";
import { IntakeForm } from "./IntakeForm";
import { useResearch } from "./useResearch";

const STEPS = [
  ["identifying", "Identify the person"],
  ["choosing", "Confirm identity"],
  ["researching", "Research & verify sources"],
  ["done", "Brief ready"],
] as const;

function Progress({ phase }: { phase: string }) {
  const idx = STEPS.findIndex(([p]) => p === phase);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]" aria-label="Research progress">
      {STEPS.map(([p, label], i) => {
        const done = idx > i || phase === "done";
        const active = idx === i && phase !== "done";
        return (
          <li key={p} className={cn("flex items-center gap-2", active ? "text-ink" : done ? "text-ink-soft" : "text-faint")}>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px]",
                done ? "border-navy bg-navy text-paper" : active ? "border-brass text-brass" : "border-hairline",
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            {label}
            {active && <span className="pulse-dot size-1.5 rounded-full bg-brass" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function CandidatePicker({
  candidates,
  sources,
  onChoose,
  note,
}: {
  candidates: IdentityCandidate[];
  sources: ResearchSource[];
  onChoose: (c: IdentityCandidate) => void;
  note?: string;
}) {
  return (
    <section aria-labelledby="h-candidates" className="animate-rise">
      <div className="eyebrow mb-1">Identity check</div>
      <h2 id="h-candidates" className="font-display text-[32px] leading-tight text-ink">
        {candidates.length} people match this name
      </h2>
      <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-soft">
        Choose the person who filled in the card. Research continues only for the person you select; details from
        different people are never combined.
      </p>
      {note && <p className="mt-2 text-[12.5px] text-muted italic">{note}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {candidates.map((c) => (
          <Card key={c.id} className="flex flex-col p-5" data-testid="candidate">
            <div className="font-display text-[24px] leading-tight text-ink">{c.name}</div>
            <div className="mt-1 text-[13.5px] text-ink-soft">
              {[c.role, c.organization].filter(Boolean).join(", ") || "Role not established"}
            </div>
            {c.region && <div className="text-[12.5px] text-muted">{c.region}</div>}
            {c.distinguishingDetails.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-[12.5px] text-ink-soft">
                {c.distinguishingDetails.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <SourceChips ids={c.sourceIds} sources={sources} />
            </div>
            <div className="mt-auto pt-5">
              <Button variant="outline" onClick={() => onChoose(c)}>
                This is the person
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Explainer({ live }: { live: boolean }) {
  return (
    <div className="space-y-6 lg:pt-2">
      <div>
        <div className="eyebrow mb-3">How the research works</div>
        <ol className="space-y-4">
          {[
            ["Search", "Public professional sources: company sites, biographies, business press. Never LinkedIn or people-search sites."],
            ["Identify", "If several people share the name, you choose the right one. Details are never merged across people."],
            ["Verify", "Each claim is linked to the sources the search returned. The app — not the AI — sets its status."],
            ["Synthesize", "A brief separates verified facts, what the prospect told you, AI interpretation, and gaps."],
            ["Decide", "You get two or three options with trade-offs. Nothing is chosen or sent for you."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="font-display w-5 shrink-0 text-[20px] leading-none text-brass">{i + 1}</span>
              <div>
                <div className="text-[13.5px] font-medium text-ink">{t}</div>
                <div className="text-[12.5px] leading-relaxed text-muted">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-[3px] border border-hairline bg-sunk/60 p-4 text-[12px] leading-relaxed text-ink-soft">
        <div className="eyebrow mb-1">What this tool will not do</div>
        Estimate income, net worth or home value; use personal characteristics; look up home addresses or private
        contact details; or contact anyone automatically.
        {live && " Live requests are rate-limited and their token usage is recorded."}
      </div>
    </div>
  );
}

export function ResearchWorkspace() {
  const { mode, session, start, choose, retry, reset } = useResearch();
  const brief = useDesk((s) => (session?.briefId ? s.briefs[session.briefId] : undefined));
  const pending = useDesk((s) => s.pendingResearch);
  const clearPending = useDesk((s) => s.clearPending);

  // A discovery result asked to be researched: start it here.
  useEffect(() => {
    if (pending && pending.mode === mode) {
      clearPending();
      start(pending.input, false);
    }
  }, [pending, mode, clearPending, start]);

  const phase = session?.phase ?? "idle";
  const busy = phase === "identifying" || phase === "researching";
  const step: LoopStep =
    phase === "done" ? "Explore" : phase === "choosing" ? "Investigate" : busy ? "Investigate" : "Observe";

  const showForm = phase === "idle" || phase === "not-found" || (phase === "error" && session?.failedStep === "identify");

  return (
    <div>
      <PageHeader
        eyebrow="Workspace I"
        title="Research Prospect"
        lede="Enter someone who filled in an interest card. The desk researches their public professional background, shows exactly what is verified and what isn't, and lays out options for you to consider."
        step={step}
        aside={
          session && phase !== "idle" ? (
            <Button variant="outline" onClick={reset} disabled={busy}>
              <RotateCcw /> New research
            </Button>
          ) : null
        }
      />

      {showForm ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,460px)_1fr]">
          <IntakeForm
            key={mode}
            mode={mode}
            initial={session?.input}
            initialShare={session?.shareCustomerDetails}
            busy={busy}
            onSubmit={start}
          />
          <div className="space-y-6">
            {phase === "not-found" && (
              <div data-testid="not-found">
                <EmptyState title="No credible public match found">
                  {session?.identify?.note ??
                    "The search did not find a public professional profile for this name. Try adding a company or region, or check the spelling."}
                </EmptyState>
                <div className="mt-2 text-center">
                  <UsageLine usage={session?.identify?.usage} />
                </div>
              </div>
            )}
            {phase === "error" && session?.error && <ErrorPanel error={session.error} onRetry={retry} />}
            <Explainer live={mode === "live"} />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="eyebrow">Researching</span>
              <span className="font-display text-[22px] text-ink">{session?.input.fullName}</span>
              {session?.input.company && <span className="text-[13px] text-muted">{session.input.company}</span>}
              <Badge tone={mode === "demo" ? "brass" : "navy"}>{mode === "demo" ? "Sample" : "Live"}</Badge>
            </div>
            <Progress phase={phase === "error" ? "researching" : phase} />
          </div>

          {phase === "choosing" && session?.identify && (
            <CandidatePicker
              candidates={session.identify.candidates}
              sources={session.identify.sources}
              onChoose={choose}
              note={session.identify.note}
            />
          )}

          {busy && (
            <div className="space-y-4" aria-busy="true" aria-live="polite">
              <p className="text-[13px] text-muted">
                {phase === "identifying"
                  ? "Searching public professional sources for matching people…"
                  : "Gathering and checking sources for the selected person, then writing the brief…"}
              </p>
              <div className="skeleton h-10 w-2/5" />
              <div className="skeleton h-4 w-3/5" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
              </div>
            </div>
          )}

          {phase === "error" && session?.error && <ErrorPanel error={session.error} onRetry={retry} />}

          {phase === "done" && brief && <BriefView brief={brief} />}
          {phase === "done" && !brief && (
            <EmptyState title="This brief is no longer available">Start a new research request.</EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
