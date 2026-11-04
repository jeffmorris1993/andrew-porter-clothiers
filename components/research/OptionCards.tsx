"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ProspectBrief } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";

/* Next-step options. None is pre-selected or ranked; Andrew records his own choice. */

export function OptionCards({ brief, onJumpToFinding }: { brief: ProspectBrief; onJumpToFinding?: (id: string) => void }) {
  const decisions = useDesk((s) => s.decisions);
  const decide = useDesk((s) => s.decide);
  const latest = decisions.find((d) => d.briefId === brief.id);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!brief.suggestedActions.length) {
    return <p className="text-[13px] text-muted">No options were generated for this brief.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-muted">
        These are possibilities, not recommendations. They are listed in no particular order and nothing happens until
        you decide.
      </p>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {brief.suggestedActions.map((a, i) => {
          const chosen = latest?.actionId === a.id;
          return (
            <article
              key={a.id}
              data-testid="option-card"
              className={cn(
                "flex flex-col rounded-[4px] border bg-raised p-5 transition-colors",
                chosen ? "border-navy shadow-card" : "border-hairline",
              )}
            >
              <div className="mb-1 text-[10.5px] tracking-[0.14em] text-faint uppercase">Option {i + 1}</div>
              <h3 className="font-display text-[21px] leading-snug text-ink">{a.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{a.description}</p>

              <dl className="mt-4 space-y-3 text-[12.5px] leading-relaxed">
                <div>
                  <dt className="eyebrow mb-0.5">Why it might make sense</dt>
                  <dd className="text-ink-soft">{a.rationale}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-0.5">Supporting evidence</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {a.supportingFindingIds.length ? (
                      a.supportingFindingIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onJumpToFinding?.(id)}
                          className="rounded-[2px] border border-hairline px-1.5 text-[11px] text-navy hover:border-brass"
                        >
                          {id}
                        </button>
                      ))
                    ) : (
                      <span className="text-faint italic">No specific finding</span>
                    )}
                  </dd>
                </div>
                {a.uncertainties.length > 0 && (
                  <div>
                    <dt className="eyebrow mb-0.5">What is uncertain</dt>
                    <dd>
                      <ul className="list-disc space-y-0.5 pl-4 text-ink-soft">
                        {a.uncertainties.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                {a.tradeoffs.length > 0 && (
                  <div>
                    <dt className="eyebrow mb-0.5">Trade-offs</dt>
                    <dd>
                      <ul className="list-disc space-y-0.5 pl-4 text-ink-soft">
                        {a.tradeoffs.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                {a.missingInformation.length > 0 && (
                  <div>
                    <dt className="eyebrow mb-0.5">Missing information</dt>
                    <dd className="text-ink-soft">{a.missingInformation.join("; ")}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 rounded-[3px] bg-sunk px-3 py-2.5 text-[12.5px] leading-snug text-ink">
                <span className="eyebrow mr-1">Your decision</span> {a.decisionForAndrew}
              </div>

              <div className="mt-auto pt-4">
                {chosen ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-navy" data-testid="decision-recorded">
                    <Check className="size-4" /> You chose this option
                    {latest?.note ? <span className="text-muted">— {latest.note}</span> : null}
                  </div>
                ) : noteFor === a.id ? (
                  <div className="space-y-2">
                    <Textarea
                      aria-label="Optional note about your decision"
                      placeholder="Optional note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="min-h-0 text-[13px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          decide({
                            subjectName: brief.professionalProfile.name,
                            briefId: brief.id,
                            actionId: a.id,
                            actionTitle: a.title,
                            choice: a.title,
                            note: note.trim() || undefined,
                          });
                          setNoteFor(null);
                          setNote("");
                        }}
                      >
                        Confirm my decision
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setNoteFor(a.id)}>
                    I&apos;ll take this option
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-[11.5px] text-faint">
        Recording a decision only notes it on your Decision Desk. No message is sent and no CRM record is changed.
      </p>
    </div>
  );
}
