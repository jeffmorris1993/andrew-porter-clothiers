"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, MessageSquare, QrCode, Sparkles, Tablet, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SAMPLE_CUSTOMER } from "@/lib/journey/demo";
import { customerNextAction, customerStageLabel, orderComplete, orderStarted } from "@/lib/journey/machine";
import { SAMPLE_SLOTS } from "@/lib/journey/milestones";
import {
  BUDGETS,
  COLORS,
  CONSULT_PREFS,
  CONTACT_METHODS,
  ConsultationRequestSchema,
  FITS,
  INTERESTS,
  InterestSubmissionSchema,
  STYLE_DIRECTIONS,
  StylePreferencesSchema,
  TIMELINES,
  WEAR_OCCASIONS,
  type ClientJourney,
} from "@/lib/journey/schemas";
import { useJourney } from "@/lib/journey/store";
import { cn } from "@/lib/utils";
import { Chip, ChoiceCard, MilestoneTimeline, SimulatedNote, formatWhen } from "./shared";

/* ─────────────────────────────────────────────────────────────────
   THE CUSTOMER'S SCREEN — a concierge experience, not a form.
   Rendered in a phone-width "device" column on desktop.
   ───────────────────────────────────────────────────────────────── */

function toggle<T>(list: T[], v: T, max = 99): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v];
}

function Progress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="mb-6" aria-label={`Step ${step} of ${total}: ${label}`}>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-[3px] flex-1 rounded-full transition-colors duration-500", i < step ? "bg-brass" : "bg-hairline")} />
        ))}
      </div>
      <div className="mt-2 text-[10.5px] tracking-[0.16em] text-muted uppercase">
        Step {step} of {total} · {label}
      </div>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-7">
      <legend className="font-display mb-1 text-[22px] leading-tight text-ink">{title}</legend>
      {hint && <p className="mb-3 text-[12.5px] text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </fieldset>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-2 text-[12.5px] text-oxblood">
      {msg}
    </p>
  ) : null;
}

/* ── Stage A: Welcome ─────────────────────────────────────────── */

function Welcome() {
  const dispatch = useJourney((s) => s.dispatch);
  return (
    <div className="animate-rise">
      <div className="relative overflow-hidden rounded-[6px] bg-navy px-7 pt-10 pb-9 text-paper">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #d8c6a1 0 1px, transparent 1px 9px), repeating-linear-gradient(45deg, #d8c6a1 0 1px, transparent 1px 9px)",
          }}
        />
        <div className="relative">
          <div className="text-[10.5px] tracking-[0.28em] text-brass-soft uppercase">Andrew Porter</div>
          <div className="text-[10.5px] tracking-[0.28em] text-paper/60 uppercase">Fine Clothiers · Carmel</div>
          <h2 className="font-display mt-10 text-[40px] leading-[1.02] font-medium">
            Clothing made
            <br />
            <span className="italic">for you.</span>
          </h2>
          <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed text-paper/80">
            A few thoughtful questions help Andrew prepare a consultation that is entirely about you. It takes about three
            minutes.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-ink-soft">
        {[
          ["Tell us what you have in mind", "What you're looking for and when."],
          ["Share your style", "Colours, fit and how you'll wear it — no measurements needed."],
          ["Request a consultation", "Andrew personally confirms every appointment."],
        ].map(([t, d], i) => (
          <div key={t} className="flex gap-3">
            <span className="font-display w-5 text-[18px] leading-none text-brass">{i + 1}</span>
            <div>
              <div className="font-medium text-ink">{t}</div>
              <div className="text-muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
      <Button size="lg" className="mt-7 w-full" onClick={() => dispatch({ type: "begin" })} data-testid="journey-begin">
        Begin <ArrowRight />
      </Button>
      <div className="mt-6 border-t border-hairline pt-4">
        <div className="text-[10.5px] tracking-[0.14em] text-muted uppercase">How clients could arrive here</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11.5px] text-ink-soft">
          {[
            [QrCode, "QR code in the studio"],
            [Tablet, "Studio tablet"],
            [Link2, "Link from Andrew"],
          ].map(([Icon, l]) => {
            const I = Icon as typeof QrCode;
            return (
              <span key={l as string} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1">
                <I className="size-3.5 text-brass" aria-hidden /> {l as string}
              </span>
            );
          })}
        </div>
        <SimulatedNote className="mt-2">Illustrative entry points — no QR system is connected.</SimulatedNote>
      </div>
    </div>
  );
}

/* ── Stage A (cont.): the interest card, 3 short screens ─────── */

type InterestForm = {
  name: string;
  email: string;
  phone: string;
  preferredContact: "email" | "phone" | "text";
  interests: (keyof typeof INTERESTS)[];
  interestOther: string;
  occasion: string;
  timeline?: keyof typeof TIMELINES;
  budgetRange?: keyof typeof BUDGETS;
  aiConsent: boolean;
};

function InterestStep({ presenter }: { presenter: boolean }) {
  const dispatch = useJourney((s) => s.dispatch);
  const [page, setPage] = useState(0);
  const [f, setF] = useState<InterestForm>({
    name: "",
    email: "",
    phone: "",
    preferredContact: "email",
    interests: [],
    interestOther: "",
    occasion: "",
    aiConsent: false,
  });
  const [err, setErr] = useState<string | undefined>();
  const set = <K extends keyof InterestForm>(k: K, v: InterestForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const pageValid = () => {
    if (page === 0) {
      if (f.interests.length === 0) return "Choose at least one";
      if (f.interests.includes("other") && !f.interestOther.trim()) return "Tell us what else you have in mind";
    }
    if (page === 1) {
      if (f.occasion.trim().length < 2) return "Tell us the occasion or purpose";
      if (!f.timeline) return "Choose a timeline";
    }
    return undefined;
  };

  const next = () => {
    const e = pageValid();
    setErr(e);
    if (!e) setPage((p) => p + 1);
  };

  const submit = () => {
    const parsed = InterestSubmissionSchema.safeParse({ ...f });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message);
      return;
    }
    setErr(undefined);
    dispatch({ type: "submitInterest", interest: parsed.data });
  };

  const fillSample = () => {
    const s = SAMPLE_CUSTOMER.interest;
    setF({ ...f, ...s, interests: [...s.interests] });
    setErr(undefined);
  };

  const labels = ["What you're looking for", "Occasion & timing", "How to reach you"];
  return (
    <div className="animate-rise" key={page}>
      <Progress step={page + 1} total={3} label={labels[page]} />
      {presenter && (
        <button type="button" onClick={fillSample} className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-brass underline-offset-4 hover:underline" data-testid="fill-sample">
          <Sparkles className="size-3.5" /> Presenter: fill sample answers
        </button>
      )}

      {page === 0 && (
        <Question title="What brings you in?" hint="Choose any that apply.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(INTERESTS) as (keyof typeof INTERESTS)[]).map((k) => (
              <Chip key={k} selected={f.interests.includes(k)} onClick={() => set("interests", toggle(f.interests, k))} testId={`interest-${k}`}>
                {INTERESTS[k]}
              </Chip>
            ))}
          </div>
          {f.interests.includes("other") && (
            <Input className="mt-3" aria-label="Something else" placeholder="Tell us more" value={f.interestOther} onChange={(e) => set("interestOther", e.target.value)} />
          )}
        </Question>
      )}

      {page === 1 && (
        <>
          <Question title="What's the occasion?" hint="A wedding, a new role, everyday wear — whatever it's for.">
            <Textarea aria-label="Occasion or purpose" rows={2} value={f.occasion} onChange={(e) => set("occasion", e.target.value)} />
          </Question>
          <Question title="When would you like it?">
            <div role="radiogroup" aria-label="Timeline" className="grid grid-cols-2 gap-2">
              {(Object.keys(TIMELINES) as (keyof typeof TIMELINES)[]).map((k) => (
                <ChoiceCard key={k} selected={f.timeline === k} onClick={() => set("timeline", k)} title={TIMELINES[k]} testId={`timeline-${k}`} />
              ))}
            </div>
          </Question>
          <Question title="A budget in mind?" hint="Entirely optional. It simply helps Andrew suggest the right starting point.">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BUDGETS) as (keyof typeof BUDGETS)[]).map((k) => (
                <Chip key={k} selected={f.budgetRange === k} onClick={() => set("budgetRange", f.budgetRange === k ? undefined : k)}>
                  {BUDGETS[k]}
                </Chip>
              ))}
            </div>
          </Question>
        </>
      )}

      {page === 2 && (
        <>
          <div className="mb-5 space-y-4">
            <div>
              <Label htmlFor="j-name">Your name</Label>
              <Input id="j-name" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="j-email">Email</Label>
              <Input id="j-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="j-phone">Phone (optional)</Label>
              <Input id="j-phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" />
            </div>
          </div>
          <Question title="How should Andrew reach you?">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CONTACT_METHODS) as (keyof typeof CONTACT_METHODS)[]).map((k) => (
                <Chip key={k} selected={f.preferredContact === k} onClick={() => set("preferredContact", k)}>
                  {CONTACT_METHODS[k]}
                </Chip>
              ))}
            </div>
          </Question>
          <label className="flex items-start gap-3 rounded-[3px] border border-hairline bg-raised p-3 text-[12.5px] leading-snug text-ink-soft">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--navy)]" checked={f.aiConsent} onChange={(e) => set("aiConsent", e.target.checked)} data-testid="ai-consent" />
            <span>
              Andrew may use an AI assistant to summarize my answers while preparing for our consultation.
              <span className="block text-muted">Optional. Your answers are only ever seen by Andrew.</span>
            </span>
          </label>
          <SimulatedNote className="mt-3">Demo only — please use fictional details. Nothing is sent anywhere.</SimulatedNote>
        </>
      )}

      <FieldError msg={err} />
      <div className="mt-7 flex gap-2">
        {page > 0 && (
          <Button variant="outline" size="lg" onClick={() => setPage((p) => p - 1)} aria-label="Back">
            <ArrowLeft />
          </Button>
        )}
        {page < 2 ? (
          <Button size="lg" className="flex-1" onClick={next} data-testid="interest-next">
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={submit} data-testid="interest-submit">
            Send to Andrew <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Stage B: Style questionnaire ─────────────────────────────── */

function StyleStep({ presenter, name }: { presenter: boolean; name: string }) {
  const dispatch = useJourney((s) => s.dispatch);
  const [colors, setColors] = useState<(keyof typeof COLORS)[]>([]);
  const [dir, setDir] = useState<keyof typeof STYLE_DIRECTIONS | undefined>();
  const [occ, setOcc] = useState<(keyof typeof WEAR_OCCASIONS)[]>([]);
  const [fit, setFit] = useState<keyof typeof FITS | undefined>();
  const [inspiration, setInspiration] = useState("");
  const [prefs, setPrefs] = useState<(keyof typeof CONSULT_PREFS)[]>([]);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string>();

  const submit = () => {
    const parsed = StylePreferencesSchema.safeParse({ colors, styleDirection: dir, wearOccasions: occ, fit, inspiration, consultationPrefs: prefs, notes });
    if (!parsed.success) {
      setErr(!dir ? "Choose a style direction" : !fit ? "Choose a fit" : parsed.error.issues[0]?.message);
      return;
    }
    dispatch({ type: "submitStyle", style: parsed.data });
  };
  const fill = () => {
    const s = SAMPLE_CUSTOMER.style;
    setColors([...s.colors]);
    setDir(s.styleDirection);
    setOcc([...s.wearOccasions]);
    setFit(s.fit);
    setInspiration(s.inspiration);
    setPrefs([...s.consultationPrefs]);
    setNotes(s.notes);
  };

  return (
    <div className="animate-rise">
      <div className="mb-6">
        <div className="text-[10.5px] tracking-[0.16em] text-brass uppercase">Thank you, {name.split(" ")[0]}</div>
        <h2 className="font-display mt-1 text-[32px] leading-[1.05] text-ink">Your personal style</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          These are preferences to guide the conversation, not garment specifications — Andrew finalises every detail with you
          in person, including measurements at your fitting.
        </p>
      </div>
      {presenter && (
        <button type="button" onClick={fill} className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-brass underline-offset-4 hover:underline" data-testid="fill-style">
          <Sparkles className="size-3.5" /> Presenter: fill sample answers
        </button>
      )}
      <Question title="Colours you're drawn to">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((k) => (
            <Chip key={k} swatch={COLORS[k].hex} selected={colors.includes(k)} onClick={() => setColors(toggle(colors, k))}>
              {COLORS[k].label}
            </Chip>
          ))}
        </div>
      </Question>
      <Question title="Your style leans…">
        <div role="radiogroup" aria-label="Style direction" className="grid gap-2">
          {(Object.keys(STYLE_DIRECTIONS) as (keyof typeof STYLE_DIRECTIONS)[]).map((k) => (
            <ChoiceCard key={k} selected={dir === k} onClick={() => setDir(k)} title={STYLE_DIRECTIONS[k].label} hint={STYLE_DIRECTIONS[k].hint} testId={`style-${k}`} />
          ))}
        </div>
      </Question>
      <Question title="Where you'll wear it">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WEAR_OCCASIONS) as (keyof typeof WEAR_OCCASIONS)[]).map((k) => (
            <Chip key={k} selected={occ.includes(k)} onClick={() => setOcc(toggle(occ, k))}>
              {WEAR_OCCASIONS[k]}
            </Chip>
          ))}
        </div>
      </Question>
      <Question title="How you like things to fit">
        <div role="radiogroup" aria-label="Fit preference" className="grid grid-cols-2 gap-2">
          {(Object.keys(FITS) as (keyof typeof FITS)[]).map((k) => (
            <ChoiceCard key={k} selected={fit === k} onClick={() => setFit(k)} title={FITS[k].label} hint={FITS[k].hint} testId={`fit-${k}`} />
          ))}
        </div>
      </Question>
      <Question title="Inspiration" hint="A look you admire, a detail you love — in your own words.">
        <Textarea aria-label="Inspiration or style notes" rows={2} value={inspiration} onChange={(e) => setInspiration(e.target.value)} />
      </Question>
      <Question title="For your consultation">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CONSULT_PREFS) as (keyof typeof CONSULT_PREFS)[]).map((k) => (
            <Chip key={k} selected={prefs.includes(k)} onClick={() => setPrefs(toggle(prefs, k))}>
              {CONSULT_PREFS[k]}
            </Chip>
          ))}
        </div>
      </Question>
      <Question title="Anything else Andrew should know?">
        <Textarea aria-label="Anything else" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Question>
      <FieldError msg={err} />
      <Button size="lg" className="w-full" onClick={submit} data-testid="style-submit">
        Save my preferences <ArrowRight />
      </Button>
      <button type="button" onClick={() => dispatch({ type: "skipStyle" })} className="mt-3 w-full text-center text-[12.5px] text-muted hover:text-ink">
        Skip for now
      </button>
    </div>
  );
}

/* ── Stage C: Consultation request ────────────────────────────── */

function ConsultationStep() {
  const dispatch = useJourney((s) => s.dispatch);
  const [slots, setSlots] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string>();
  const submit = () => {
    const parsed = ConsultationRequestSchema.safeParse({ preferredSlots: slots, customRequest: custom });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message);
    dispatch({ type: "requestConsultation", preferredSlots: parsed.data.preferredSlots, customRequest: parsed.data.customRequest });
  };
  return (
    <div className="animate-rise">
      <h2 className="font-display text-[32px] leading-[1.05] text-ink">Request a consultation</h2>
      <p className="mt-2 mb-6 text-[13px] leading-relaxed text-muted">
        Choose up to three times that suit you. Andrew will personally confirm — nothing is booked until he does.
      </p>
      <Question title="Times that work for you">
        <div className="grid gap-2">
          {SAMPLE_SLOTS.map((s) => (
            <Chip key={s} selected={slots.includes(s)} onClick={() => setSlots(toggle(slots, s, 3))} testId={`slot-${s}`}>
              {s}
            </Chip>
          ))}
        </div>
      </Question>
      <Question title="Or tell us what's easiest">
        <Input aria-label="Preferred time" placeholder="e.g. any weekday after 4pm" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </Question>
      <SimulatedNote className="mb-5">Illustrative times — not connected to a calendar.</SimulatedNote>
      <FieldError msg={err} />
      <Button size="lg" className="w-full" onClick={submit} data-testid="request-consultation">
        Request consultation <ArrowRight />
      </Button>
    </div>
  );
}

/* ── Stage D–F: Personal portal & continuing relationship ─────── */

function Panel({ title, children, className, testId }: { title: string; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cn("rounded-[4px] border border-hairline bg-raised p-5", className)} data-testid={testId}>
      <h3 className="mb-3 text-[10.5px] font-medium tracking-[0.16em] text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Portal({ j }: { j: ClientJourney }) {
  const dispatch = useJourney((s) => s.dispatch);
  const [reply, setReply] = useState("");
  const [future, setFuture] = useState("");
  const first = j.interest?.name.split(" ")[0] ?? "";
  const a = j.appointment;
  const shared = j.messages.filter((m) => m.status === "shared-in-portal");
  const relationship = j.stage === "relationship" || (orderComplete(j) && j.pastOrders.length > 0);

  return (
    <div className="animate-rise space-y-4" data-testid="client-portal">
      <div className="rounded-[6px] bg-navy px-6 py-7 text-paper">
        <div className="text-[10.5px] tracking-[0.24em] text-brass-soft uppercase">Your Andrew Porter portal</div>
        <h2 className="font-display mt-3 text-[34px] leading-[1.05]">
          {relationship ? "Welcome back" : "Welcome"}, {first}.
        </h2>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-[12px]" data-testid="portal-stage">
          <span className="size-1.5 rounded-full bg-brass-soft" aria-hidden /> {customerStageLabel(j)}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-paper/80" data-testid="portal-next">
          {customerNextAction(j)}
        </p>
      </div>

      {j.infoRequest && (
        <Panel title="A question from Andrew" className="border-brass/40 bg-brass-wash/50" testId="info-request">
          <p className="mb-3 text-[14px] leading-relaxed text-ink">“{j.infoRequest.note}”</p>
          <Textarea aria-label="Your reply" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button size="sm" className="mt-2" onClick={() => dispatch({ type: "replyToInfoRequest", text: reply }) && setReply("")}>
            Reply
          </Button>
        </Panel>
      )}

      {shared.length > 0 && (
        <Panel title="From Andrew" testId="portal-messages">
          <div className="space-y-4">
            {shared.map((m) => (
              <article key={m.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-display text-[19px] text-ink">{m.subject}</div>
                  <div className="text-[11px] text-faint">{m.sharedAt && formatWhen(m.sharedAt)}</div>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-soft">{m.body}</p>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {a && !orderStarted(j) && (
        <Panel title="Your consultation" testId="portal-appointment">
          {a.status === "confirmed" ? (
            <>
              <div className="font-display text-[24px] text-ink">{a.confirmedSlot}</div>
              <div className="mt-1 text-[13px] text-ink-soft">Confirmed by Andrew · Andrew Porter Fine Clothiers, Carmel</div>
              <SimulatedNote className="mt-2">Sample appointment — not on any real calendar.</SimulatedNote>
            </>
          ) : a.status === "reschedule-suggested" ? (
            <>
              <div className="text-[14px] text-ink">Andrew suggested: “{a.andrewNote}”</div>
              <SimulatedNote className="mt-2">Reply to Andrew directly to settle a time.</SimulatedNote>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[14px] text-ink">
                <span className="pulse-dot size-2 rounded-full bg-brass" aria-hidden /> Awaiting confirmation
              </div>
              <div className="mt-1 text-[12.5px] text-muted">
                You asked for {[...a.preferredSlots, a.customRequest].filter(Boolean).join(" · ")}
              </div>
            </>
          )}
        </Panel>
      )}

      {orderStarted(j) && (
        <Panel title={relationship ? "Your completed order" : "Your order"} testId="portal-order">
          <MilestoneTimeline milestones={j.milestones} />
          <SimulatedNote className="mt-4">Andrew updates each step personally. Not linked to production, payment or shipping systems.</SimulatedNote>
        </Panel>
      )}

      {j.style && (
        <Panel title="Your saved style preferences">
          <div className="flex flex-wrap gap-1.5">
            {j.style.colors.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-soft">
                <span aria-hidden className="size-3 rounded-full" style={{ background: COLORS[c].hex }} />
                {COLORS[c].label}
              </span>
            ))}
            <span className="rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-soft">{STYLE_DIRECTIONS[j.style.styleDirection].label}</span>
            <span className="rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-soft">{FITS[j.style.fit].label} fit</span>
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Preferences only — garment details are finalised with Andrew.</p>
        </Panel>
      )}

      {relationship && (
        <>
          <Panel title="Your wardrobe with us" testId="past-orders">
            <ul className="space-y-2">
              {j.pastOrders.map((o) => (
                <li key={o.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="text-ink">{o.title}</span>
                  <span className="text-[11.5px] text-faint">{new Date(o.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-ink-soft">Navy travel blazer</span>
                <span className="text-[11.5px] text-faint">Sample earlier order</span>
              </li>
            </ul>
          </Panel>
          <Panel title="What's next">
            <Button className="w-full" onClick={() => dispatch({ type: "requestAnotherConsultation" })} data-testid="request-another">
              Request another consultation
            </Button>
            <div className="mt-4">
              <Label htmlFor="future">Something you&apos;d like in the future?</Label>
              <div className="flex gap-2">
                <Input id="future" placeholder="e.g. a winter overcoat" value={future} onChange={(e) => setFuture(e.target.value)} />
                <Button variant="outline" onClick={() => dispatch({ type: "expressFutureInterest", text: future }) && setFuture("")}>
                  Save
                </Button>
              </div>
              {j.futureInterest && <p className="mt-2 text-[12.5px] text-ink-soft">Saved: “{j.futureInterest.text}”</p>}
            </div>
          </Panel>
        </>
      )}

      {!shared.length && !j.infoRequest && (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <MessageSquare className="size-3.5" /> Messages from Andrew will appear here.
        </p>
      )}
    </div>
  );
}

export function CustomerExperience({ presenter = true }: { presenter?: boolean }) {
  const j = useJourney((s) => s.journey);
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <div className="rounded-[22px] border border-hairline bg-paper p-5 shadow-pop sm:p-7" data-testid="customer-screen">
        <div className="mb-5 flex items-center justify-between text-[10.5px] tracking-[0.16em] text-faint uppercase">
          <span>andrewporter.example/welcome</span>
          <span>Client view</span>
        </div>
        {j.stage === "welcome" && <Welcome />}
        {j.stage === "interest" && <InterestStep presenter={presenter} />}
        {j.stage === "style" && <StyleStep presenter={presenter} name={j.interest?.name ?? ""} />}
        {j.stage === "consultation" && <ConsultationStep />}
        {(j.stage === "portal" || j.stage === "relationship") && <Portal j={j} />}
      </div>
    </div>
  );
}
