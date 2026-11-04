"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, FileText, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, EmptyState, ErrorPanel, SectionTitle, UsageLine } from "@/components/research/bits";
import { ClientError } from "@/lib/client/api";
import { requestBrief } from "@/lib/journey/client";
import { currentMilestoneIndex, orderComplete, orderStarted } from "@/lib/journey/machine";
import { toBriefRequest } from "@/lib/journey/request";
import {
  BUDGETS,
  COLORS,
  CONSULT_PREFS,
  CONTACT_METHODS,
  FITS,
  INTERESTS,
  STYLE_DIRECTIONS,
  TIMELINES,
  WEAR_OCCASIONS,
} from "@/lib/journey/schemas";
import type { ApiError as ApiErrorLike } from "@/lib/schemas";
import { useJourney } from "@/lib/journey/store";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { MilestoneTimeline, SimulatedNote, formatWhen } from "./shared";

/* ─────────────────────────────────────────────────────────────────
   ANDREW'S WORKSPACE — the same journey, from the studio side.
   Every change here is an explicit choice by Andrew.
   ───────────────────────────────────────────────────────────────── */

function Row({ k, v }: { k: string; v?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-t border-hairline-soft py-2.5 text-[13.5px] first:border-0">
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className={cn(v ? "text-ink" : "text-faint italic")}>{v || "Not provided"}</dd>
    </div>
  );
}

function ClientOverview() {
  const j = useJourney((s) => s.journey);
  const i = j.interest!;
  const s = j.style;
  return (
    <section aria-labelledby="h-overview">
      <SectionTitle id="h-overview" title="Client overview" hint="Exactly what the customer provided. Not verified, not AI." />
      <div className="rounded-[4px] border border-brass/30 bg-brass-wash/50 p-5" data-testid="client-overview">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="brass">Provided by the client</Badge>
          <span className="text-[11.5px] text-muted">Submitted {formatWhen(i.submittedAt)}</span>
        </div>
        <div className="font-display text-[30px] leading-tight text-ink">{i.name}</div>
        <dl className="mt-3">
          <Row k="Interested in" v={i.interests.map((x) => (x === "other" && i.interestOther ? i.interestOther : INTERESTS[x])).join(", ")} />
          <Row k="Occasion" v={i.occasion} />
          <Row k="Timeline" v={TIMELINES[i.timeline]} />
          <Row k="Budget" v={i.budgetRange ? `${BUDGETS[i.budgetRange]} (their own range)` : undefined} />
          <Row k="Contact" v={`${CONTACT_METHODS[i.preferredContact]} · ${[i.email, i.phone].filter(Boolean).join(" · ")}`} />
          <Row k="AI consent" v={i.aiConsent ? "Agreed to AI summary of answers" : "Did not agree"} />
        </dl>
        {s ? (
          <div className="mt-4 border-t border-brass/20 pt-4">
            <div className="eyebrow mb-2">Style preferences — not garment specifications</div>
            <dl>
              <Row k="Colours" v={s.colors.map((c) => COLORS[c].label).join(", ")} />
              <Row k="Direction" v={STYLE_DIRECTIONS[s.styleDirection].label} />
              <Row k="Fit" v={FITS[s.fit].label} />
              <Row k="Worn for" v={s.wearOccasions.map((w) => WEAR_OCCASIONS[w]).join(", ")} />
              <Row k="Inspiration" v={s.inspiration} />
              <Row k="Consultation" v={s.consultationPrefs.map((c) => CONSULT_PREFS[c]).join(", ")} />
              <Row k="Notes" v={s.notes && <span className="whitespace-pre-line">{s.notes}</span>} />
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted">Style questionnaire not completed yet.</p>
        )}
        {j.preferencesRecorded.length > 0 && (
          <div className="mt-4 border-t border-brass/20 pt-4">
            <div className="eyebrow mb-2">Your notes</div>
            <ul className="space-y-1 text-[13px] text-ink-soft">
              {j.preferencesRecorded.map((p) => (
                <li key={p.at}>· {p.text}</li>
              ))}
            </ul>
          </div>
        )}
        {j.futureInterest && <p className="mt-3 text-[13px] text-ink">Future interest: “{j.futureInterest.text}”</p>}
      </div>
    </section>
  );
}

function PrepBrief() {
  const mode = useDesk((s) => s.mode);
  const j = useJourney((s) => s.journey);
  const dispatch = useJourney((s) => s.dispatch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorLike | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const b = j.brief;
  const req = toBriefRequest(j);

  const generate = async () => {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const brief = await requestBrief(mode, req);
      dispatch({ type: "setBrief", brief });
      // Clear local edits so the new draft (with the confirmed time filled in) shows.
      setSubject("");
      setBody("");
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Request failed", retryable: true });
    } finally {
      setBusy(false);
    }
  };

  const draftSubject = subject || b?.draftMessage.subject || "";
  // Suggest the confirmed time in place of the placeholder; Andrew still reviews before sharing.
  const confirmed = j.appointment?.status === "confirmed" ? j.appointment.confirmedSlot : undefined;
  const draftBody = body || (b?.draftMessage.body ?? "").replace("[day and time]", confirmed ?? "[day and time]");
  const latestDraft = j.messages.find((m) => m.status === "draft");
  const shared = j.messages.filter((m) => m.status === "shared-in-portal");

  return (
    <section aria-labelledby="h-prep">
      <SectionTitle id="h-prep" title="AI consultation preparation" hint="Built only from what the customer provided. No web research." />

      {!b && (
        <Card className="p-5">
          {!j.interest?.aiConsent ? (
            <p className="text-[13px] text-ink-soft">The customer did not agree to an AI summary. Prepare from their answers above.</p>
          ) : (
            <>
              <label className="flex items-start gap-3 text-[13px] leading-snug text-ink-soft">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--navy)]"
                  checked={j.andrewConfirmedConsent}
                  onChange={(e) => dispatch({ type: "confirmConsent", value: e.target.checked })}
                  data-testid="andrew-consent"
                />
                <span>
                  The customer agreed to an AI summary, and I&apos;m authorized to send their answers (without contact details) to{" "}
                  {mode === "live" ? "OpenAI" : "the sample generator"}.
                </span>
              </label>
              <Button className="mt-4" onClick={generate} disabled={!req || busy} data-testid="generate-brief">
                <Sparkles /> {busy ? "Preparing…" : mode === "live" ? "Generate with live AI" : "Generate sample brief"}
              </Button>
              <p className="mt-2 text-[11.5px] text-faint">
                {mode === "live"
                  ? "One model call, no web search. Name, email and phone are not sent."
                  : "Demo Mode: a rule-based sample from the answers — clearly labeled, not AI."}
              </p>
            </>
          )}
          {busy && <div className="skeleton mt-4 h-24" />}
          {error && (
            <div className="mt-4">
              <ErrorPanel error={error} onRetry={generate} context="The preparation brief could not be generated" />
            </div>
          )}
        </Card>
      )}

      {b && (
        <div className="space-y-6" data-testid="prep-brief">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={b.mode === "live" ? "navy" : "brass"}>{b.mode === "live" ? "Live AI interpretation" : "Sample response · not AI"}</Badge>
            <span className="text-[11.5px] text-faint">Generated {formatWhen(b.generatedAt)}</span>
            <Button size="sm" variant="ghost" onClick={generate} disabled={busy || !req}>
              Regenerate
            </Button>
          </div>
          {b.systemNotes.length > 0 && (
            <ul className="space-y-1 rounded-[3px] bg-sunk/70 px-4 py-3 text-[12px] text-ink-soft">
              {b.systemNotes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}
          <p className="font-display text-[20px] leading-[1.5] text-ink">{b.summary}</p>
          <div className="grid gap-6 md:grid-cols-2">
            {(
              [
                ["Stated preferences", b.statedPreferences],
                ["Timing", b.timingConstraints],
                ["Still unknown", b.unansweredQuestions],
                ["Questions to ask", b.consultationQuestions],
              ] as const
            ).map(([t, list]) => (
              <div key={t}>
                <div className="eyebrow mb-2">{t}</div>
                <ul className="space-y-1.5 text-[13.5px] leading-snug text-ink">
                  {list.map((x) => (
                    <li key={x} className="border-l-2 border-brass-soft pl-3">
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow mb-2">Possible next actions · not ranked, you decide</div>
            <div className="grid gap-3 md:grid-cols-3">
              {b.suggestedActions.map((a) => (
                <article key={a.title} className="rounded-[4px] border border-hairline bg-raised p-4 text-[12.5px] leading-relaxed">
                  <h4 className="font-display text-[18px] leading-snug text-ink">{a.title}</h4>
                  <p className="mt-1 text-ink-soft">{a.why}</p>
                  {a.tradeoffs.length > 0 && <p className="mt-2 text-muted">Trade-offs: {a.tradeoffs.join(" · ")}</p>}
                  <p className="mt-2 rounded-[3px] bg-sunk px-2.5 py-1.5 text-ink">{a.decisionForAndrew}</p>
                </article>
              ))}
            </div>
          </div>
          <Card className="p-5" data-testid="journey-draft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display flex items-center gap-2 text-[20px] text-ink">
                <FileText className="size-4 text-brass" /> Personal message draft
              </h4>
              <Badge tone="oxblood">Draft · nothing is emailed</Badge>
            </div>
            <Label htmlFor="jd-subject">Subject</Label>
            <Input id="jd-subject" value={draftSubject} onChange={(e) => setSubject(e.target.value)} />
            <Label htmlFor="jd-body" className="mt-3">
              Message
            </Label>
            <Textarea id="jd-body" rows={9} value={draftBody} onChange={(e) => setBody(e.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  dispatch({ type: "saveDraft", draft: { subject: draftSubject, body: draftBody, source: b.mode === "live" ? "live-ai" : "demo-sample" } });
                  const id = useJourney.getState().journey.messages[0].id;
                  dispatch({ type: "shareMessage", id, subject: draftSubject, body: draftBody });
                }}
                disabled={!draftBody.trim()}
                data-testid="share-message"
              >
                Share in client portal
              </Button>
              {latestDraft && <span className="self-center text-[11.5px] text-faint">Draft saved</span>}
            </div>
            <SimulatedNote className="mt-3">Sharing places the message in the demo client portal only. No email or text is sent.</SimulatedNote>
            {shared.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-navy">
                <Check className="size-3.5" /> {shared.length} message{shared.length === 1 ? "" : "s"} shared in the portal
              </p>
            )}
          </Card>
          <UsageLine usage={b.usage} />
        </div>
      )}
    </section>
  );
}

function Decisions() {
  const j = useJourney((s) => s.journey);
  const dispatch = useJourney((s) => s.dispatch);
  const refusal = useJourney((s) => s.lastRefusal);
  const queueResearch = useDesk((s) => s.queueResearch);
  const setSession = useDesk((s) => s.setSession);
  const router = useRouter();
  const a = j.appointment;
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [pref, setPref] = useState("");
  const [follow, setFollow] = useState("");
  const options = a ? [...a.preferredSlots, ...(a.customRequest ? [a.customRequest] : [])] : [];
  const chosenSlot = slot || options[0] || "";
  const idx = currentMilestoneIndex(j);
  const next = idx >= 0 ? j.milestones[idx + 1] : undefined;

  return (
    <section aria-labelledby="h-decisions">
      <SectionTitle id="h-decisions" title="Your decisions" hint="Nothing changes for the customer until you choose. Each choice is recorded below." />
      <div className="space-y-4">
        <Card className="p-5" data-testid="decision-appointment">
          <div className="eyebrow mb-1">Consultation request</div>
          {!a ? (
            <p className="text-[13px] text-muted">No consultation requested yet.</p>
          ) : a.status === "confirmed" ? (
            <p className="text-[13.5px] text-ink">
              <Check className="mr-1 inline size-4 text-sage" /> Confirmed for {a.confirmedSlot} <span className="text-faint">(sample appointment)</span>
            </p>
          ) : (
            <>
              <p className="mb-2 text-[13px] text-ink-soft">
                Requested: {options.join(" · ")} {a.status === "reschedule-suggested" && <em className="text-muted">— you suggested another time</em>}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="slot">Confirm for</Label>
                  <select
                    id="slot"
                    value={chosenSlot}
                    onChange={(e) => setSlot(e.target.value)}
                    className="h-9 rounded-[3px] border border-hairline bg-raised px-2 text-[13px]"
                  >
                    {options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <Button size="sm" className="h-9" onClick={() => dispatch({ type: "approveAppointment", slot: chosenSlot })} data-testid="approve-appointment">
                  Approve this time
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <Input aria-label="Suggest another time" placeholder="Or suggest another time…" value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
                <Button size="sm" variant="outline" className="h-9" disabled={!note.trim()} onClick={() => dispatch({ type: "suggestReschedule", note }) && setNote("")}>
                  Suggest
                </Button>
              </div>
              <SimulatedNote className="mt-2">Approval updates the demo portal only — no calendar is connected.</SimulatedNote>
            </>
          )}
        </Card>

        <Card className="p-5" data-testid="decision-order">
          <div className="eyebrow mb-2">Sample order progress</div>
          {!orderStarted(j) ? (
            <>
              <p className="mb-3 text-[13px] text-ink-soft">After you meet, mark the consultation completed to start the order timeline.</p>
              <Button size="sm" onClick={() => dispatch({ type: "markConsultationCompleted" })} disabled={a?.status !== "confirmed"} data-testid="complete-consultation">
                Mark consultation completed
              </Button>
              {a?.status !== "confirmed" && <p className="mt-2 text-[11.5px] text-faint">Available once the consultation is confirmed.</p>}
            </>
          ) : (
            <>
              <MilestoneTimeline milestones={j.milestones} compact />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "stepBackMilestone" })} disabled={idx <= 0} aria-label="Step back one milestone">
                  <ChevronLeft /> Correct
                </Button>
                <Button size="sm" onClick={() => dispatch({ type: "advanceMilestone" })} disabled={orderComplete(j)} data-testid="advance-milestone">
                  {orderComplete(j) ? "Order complete" : next ? <>Advance to “{next.label}” <ChevronRight /></> : <>Mark “{j.milestones[idx]?.label}” done <ChevronRight /></>}
                </Button>
              </div>
              <SimulatedNote className="mt-2">You update each step yourself. No payment, production or shipping system is connected.</SimulatedNote>
            </>
          )}
        </Card>

        <Card className="grid gap-5 p-5 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-1">Request more information</div>
            <p className="mb-2 text-[12px] text-muted">Appears as a question in the client portal.</p>
            <RequestInfo />
          </div>
          <div>
            <div className="eyebrow mb-1">Record a preference</div>
            <p className="mb-2 text-[12px] text-muted">Your own note, e.g. from a conversation.</p>
            <div className="flex gap-2">
              <Input aria-label="Preference" value={pref} onChange={(e) => setPref(e.target.value)} className="h-9" placeholder="Prefers horn buttons" />
              <Button size="sm" variant="outline" className="h-9" disabled={!pref.trim()} onClick={() => dispatch({ type: "recordPreference", text: pref }) && setPref("")}>
                Save
              </Button>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">Mark for follow-up</div>
            <div className="flex gap-2">
              <Input aria-label="Follow-up" value={follow} onChange={(e) => setFollow(e.target.value)} className="h-9" placeholder="Check in after the presentation" />
              <Button size="sm" variant="outline" className="h-9" disabled={!follow.trim()} onClick={() => dispatch({ type: "markFollowUp", text: follow }) && setFollow("")}>
                Add
              </Button>
            </div>
            {j.followUps.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12.5px]">
                {j.followUps.map((f, i) => (
                  <li key={f.at} className="flex items-center gap-2">
                    <input type="checkbox" checked={f.done} onChange={() => dispatch({ type: "completeFollowUp", index: i })} aria-label={`Done: ${f.text}`} className="accent-[var(--navy)]" />
                    <span className={f.done ? "text-faint line-through" : "text-ink-soft"}>{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="eyebrow mb-1">Public professional research</div>
            <p className="mb-2 text-[12px] text-muted">Separate and deliberate — opens Research Prospect. Nothing runs automatically.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSession(undefined);
                queueResearch({ fullName: j.interest!.name });
                router.push("/research");
              }}
            >
              <Search /> Research {j.interest!.name.split(" ")[0]}
            </Button>
          </div>
        </Card>
        {refusal && (
          <p role="status" className="text-[12.5px] text-oxblood">
            {refusal}
          </p>
        )}
      </div>
    </section>
  );
}

function RequestInfo() {
  const dispatch = useJourney((s) => s.dispatch);
  const open = useJourney((s) => s.journey.infoRequest);
  const [q, setQ] = useState("");
  if (open) return <p className="text-[12.5px] text-ink-soft">Waiting for a reply to: “{open.note}”</p>;
  return (
    <div className="flex gap-2">
      <Input aria-label="Question for the customer" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" placeholder="Is there a date for the first wear?" />
      <Button size="sm" variant="outline" className="h-9" disabled={!q.trim()} onClick={() => dispatch({ type: "requestMoreInfo", note: q }) && setQ("")} data-testid="request-info">
        Ask
      </Button>
    </div>
  );
}

function Activity() {
  const activity = useJourney((s) => s.journey.activity);
  return (
    <section aria-labelledby="h-activity">
      <SectionTitle id="h-activity" title="Activity" />
      <ol className="space-y-2.5" data-testid="journey-activity">
        {activity.map((e) => (
          <li key={e.id} className="grid grid-cols-[86px_1fr] gap-3 text-[12.5px] leading-snug">
            <span className="text-faint tabular-nums">{formatWhen(e.at)}</span>
            <span>
              <span className={cn("mr-1.5 text-[10px] tracking-[0.12em] uppercase", e.actor === "andrew" ? "text-navy" : e.actor === "customer" ? "text-brass" : "text-muted")}>
                {e.actor === "andrew" ? "You" : e.actor === "customer" ? "Client" : "System"}
              </span>
              <span className="text-ink-soft">{e.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FUTURE = [
  ["Calendar booking", "Confirmed times written to Andrew's calendar"],
  ["Deposits & payments", "e.g. Stripe, for recorded deposits"],
  ["Insightly CRM", "Client record and activity sync"],
  ["Constant Contact", "Opt-in newsletters and occasion reminders"],
  ["Email & text delivery", "Sending shared messages to the client"],
  ["Client sign-in", "So the portal works across devices"],
  ["Shared backend", "Today the journey lives in this browser only"],
];

export function AndrewWorkspace() {
  const j = useJourney((s) => s.journey);
  const dispatch = useJourney((s) => s.dispatch);
  useEffect(() => {
    if (j.interest && !j.viewedByAndrew) dispatch({ type: "markViewed" });
  }, [j.interest, j.viewedByAndrew, dispatch]);

  if (!j.interest) {
    return (
      <EmptyState title="No inquiry yet">
        When the client sends their interest card, it appears here immediately — organized and ready. Switch to the customer view to
        begin.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]" data-testid="andrew-workspace">
      <div className="min-w-0 space-y-12">
        <ClientOverview />
        <PrepBrief />
        <Decisions />
      </div>
      <aside className="space-y-10">
        <Activity />
        <details className="rounded-[4px] border border-hairline bg-raised p-4 text-[12.5px]">
          <summary className="cursor-pointer text-ink">Future production integrations</summary>
          <ul className="mt-3 space-y-2">
            {FUTURE.map(([t, d]) => (
              <li key={t}>
                <div className="text-ink">{t}</div>
                <div className="text-muted">{d} · not connected in this demo</div>
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
