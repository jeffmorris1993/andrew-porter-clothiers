"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DEMO_SCENARIOS } from "@/lib/demo/fixtures";
import { ProspectInputSchema, type Mode, type ProspectInput } from "@/lib/schemas";
import { Card } from "./bits";

const EMPTY = { fullName: "", company: "", region: "", clothingInterest: "", statedBudget: "", notes: "" };
type FormState = typeof EMPTY;

function toForm(i?: ProspectInput): FormState {
  return { ...EMPTY, ...Object.fromEntries(Object.entries(i ?? {}).map(([k, v]) => [k, v ?? ""])) } as FormState;
}

export function IntakeForm({
  mode,
  initial,
  initialShare,
  busy,
  onSubmit,
}: {
  mode: Mode;
  initial?: ProspectInput;
  initialShare?: boolean;
  busy: boolean;
  onSubmit: (input: ProspectInput, share: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [share, setShare] = useState(mode === "live" ? Boolean(initialShare) : true);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const hasCustomer = Boolean(form.clothingInterest || form.statedBudget || form.notes);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ProspectInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    // Demo data is fictional; in Live Mode sharing needs explicit consent and something to share.
    onSubmit(parsed.data, mode === "demo" ? true : share && hasCustomer);
  };

  return (
    <Card className="p-6">
      {mode === "demo" && (
        <div className="mb-6">
          <div className="eyebrow mb-2">Sample prospects</div>
          <div className="grid gap-2" role="group" aria-label="Load a sample prospect">
            {DEMO_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setForm(toForm(s.input));
                  setShare(true);
                }}
                className="rounded-[3px] border border-hairline bg-paper px-3 py-2.5 text-left transition-colors hover:border-brass"
                data-testid={`scenario-${s.id}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink">{s.input.fullName}</span>
                  <span className="text-[10.5px] tracking-[0.12em] text-brass uppercase">{s.label}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{s.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate aria-describedby={error ? "intake-error" : undefined}>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="eyebrow mb-1">Who to research</legend>
          <div>
            <Label htmlFor="fullName">
              Full name <span className="text-oxblood">*</span>
            </Label>
            <Input id="fullName" value={form.fullName} onChange={set("fullName")} autoComplete="off" required aria-required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="company">Company or organization</Label>
              <Input id="company" value={form.company} onChange={set("company")} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="region">City or region</Label>
              <Input id="region" value={form.region} onChange={set("region")} placeholder="e.g. Indianapolis" />
            </div>
          </div>

          <div className="pt-3">
            <div className="eyebrow mb-1">From the interest card</div>
            <p className="mb-3 text-[12px] text-muted">What the prospect told you. Kept separate from public research.</p>
          </div>
          <div>
            <Label htmlFor="clothingInterest">Clothing interest</Label>
            <Input id="clothingInterest" value={form.clothingInterest} onChange={set("clothingInterest")} />
          </div>
          <div>
            <Label htmlFor="statedBudget">Self-reported budget</Label>
            <Input id="statedBudget" value={form.statedBudget} onChange={set("statedBudget")} placeholder="As written on the card" />
          </div>
          <div>
            <Label htmlFor="notes">Additional notes</Label>
            <Textarea id="notes" value={form.notes} onChange={set("notes")} rows={3} />
          </div>

          {mode === "live" && (
            <label className="flex items-start gap-3 rounded-[3px] border border-hairline bg-paper p-3 text-[12.5px] leading-snug text-ink-soft">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--navy)]"
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
                disabled={!hasCustomer}
              />
              <span>
                Include the interest-card details in the AI analysis.
                <span className="block text-muted">
                  Off by default. Only the name, company and region are needed for the web search. Turn this on only if
                  you are authorized to share the customer&apos;s details with OpenAI.
                </span>
              </span>
            </label>
          )}

          {error && (
            <p id="intake-error" role="alert" className="text-[12.5px] text-oxblood">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <Search /> {busy ? "Researching…" : mode === "live" ? "Research with live web search" : "Research sample prospect"}
          </Button>
          {mode === "live" && (
            <p className="text-center text-[11px] text-faint">
              Typically 2–4 model calls and 1–2 web searches. Takes about 30–90 seconds.
            </p>
          )}
        </fieldset>
      </form>
    </Card>
  );
}
