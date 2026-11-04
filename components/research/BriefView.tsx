"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Columns3, MessageSquareText, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientError, clientFor } from "@/lib/client/api";
import type { ApiError, ProspectBrief } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { AssistantSheet } from "./Assistant";
import { Card, ErrorPanel, FindingRow, SampleTag, SectionTitle, SourceChips, SourceList, StatusLegend, UsageLine } from "./bits";
import { OptionCards } from "./OptionCards";

const IDENTITY_LABEL: Record<ProspectBrief["identityStatus"], string> = {
  "single-match": "Single public match",
  "selected-by-user": "Identity chosen by you",
  ambiguous: "Identity unresolved",
  "not-found": "Not found",
};

const SECTIONS = [
  ["overview", "A", "Overview"],
  ["summary", "B", "Summary"],
  ["verified", "C", "Verified information"],
  ["customer", "D", "Customer-provided"],
  ["gaps", "E", "Information gaps"],
  ["preparation", "F", "Preparation"],
  ["options", "G", "Next-step options"],
] as const;

export function BriefView({ brief, compact = false }: { brief: ProspectBrief; compact?: boolean }) {
  const save = useDesk((s) => s.save);
  const saved = useDesk((s) => s.saved);
  const setStatus = useDesk((s) => s.setStatus);
  const toggleCompare = useDesk((s) => s.toggleCompare);
  const compare = useDesk((s) => s.compare[s.mode]);
  const applyFollowup = useDesk((s) => s.applyFollowup);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [compareMsg, setCompareMsg] = useState<string | null>(null);

  const savedItem = saved.find((s) => s.kind === "brief" && s.refId === brief.id);
  const isSaved = savedItem?.status === "active";
  const savedId = `brief:${brief.id}`;
  const inCompare = compare.includes(savedId);
  const p = brief.professionalProfile;
  const usedSourceIds = useMemo(
    () => new Set([...brief.findings.flatMap((f) => f.sourceIds), ...(brief.identity?.sourceIds ?? [])]),
    [brief],
  );
  const cp = brief.customerProvided;
  const hasCustomer = Boolean(cp.clothingInterest || cp.statedBudget || cp.notes);

  const jump = (id: string) => {
    setHighlight(id);
    document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 2200);
  };

  return (
    <div className={cn("grid gap-10", !compact && "lg:grid-cols-[170px_1fr]")} data-testid="brief">
      {!compact && (
        <nav aria-label="Brief sections" className="hidden lg:block">
          <ol className="sticky top-6 space-y-2 text-[12.5px]">
            {SECTIONS.map(([id, letter, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 text-muted hover:text-ink">
                  <span className="font-display w-3 text-brass italic">{letter}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="min-w-0 space-y-12">
        {/* A — overview */}
        <section id="overview" aria-labelledby="h-overview" className="animate-rise">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {brief.mode === "demo" ? <SampleTag /> : <Badge tone="navy">Live research</Badge>}
            <Badge tone={brief.identityStatus === "selected-by-user" ? "brass" : "neutral"}>
              {IDENTITY_LABEL[brief.identityStatus]}
            </Badge>
            <span className="text-[11.5px] text-faint">
              Researched {new Date(brief.researchedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          <div className="eyebrow mb-1">
            <span className="font-display mr-2 text-[14px] text-brass normal-case italic">A</span>Prospect overview
          </div>
          <h2 id="h-overview" className="font-display text-[40px] leading-[1.05] font-medium text-ink sm:text-[48px]">
            {p.name}
          </h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-[13.5px] sm:grid-cols-3">
            {(
              [
                ["Role", p.role],
                ["Organization", p.organization],
                ["Location", p.location],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className={cn("mt-0.5", v ? "text-ink" : "text-faint italic")}>{v ?? "Not established"}</dd>
              </div>
            ))}
          </dl>
          {brief.identity && brief.identity.sourceIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
              Identity based on <SourceChips ids={brief.identity.sourceIds} sources={brief.sources} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              variant={isSaved ? "outline" : "primary"}
              size="sm"
              onClick={() => (isSaved ? setStatus(savedId, "dismissed") : save("brief", brief.id))}
              data-testid="save-brief"
            >
              {isSaved ? <BookmarkCheck /> : <Bookmark />} {isSaved ? "Saved to Desk" : "Save to Decision Desk"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                save("brief", brief.id);
                const ok = toggleCompare(savedId);
                setCompareMsg(ok ? null : "You can compare up to 3 profiles. Remove one on the Decision Desk first.");
              }}
            >
              <Columns3 /> {inCompare ? "In comparison" : "Add to comparison"}
            </Button>
            <AssistantSheet
              context={{ briefs: [brief], discoveries: [] }}
              onFollowup={(f) => applyFollowup(brief.id, f)}
              trigger={
                <Button variant="outline" size="sm">
                  <MessageSquareText /> Ask about this research
                </Button>
              }
            />
            {!compact && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/desk">Open Decision Desk →</Link>
              </Button>
            )}
          </div>
          {compareMsg && (
            <p role="status" className="mt-2 text-[12px] text-oxblood">
              {compareMsg}
            </p>
          )}
        </section>

        {brief.systemNotes.length > 0 && (
          <ul className="space-y-1 rounded-[3px] border border-hairline bg-sunk/60 px-4 py-3 text-[12px] text-ink-soft">
            {brief.systemNotes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        )}

        {/* B — summary */}
        <section id="summary" aria-labelledby="h-summary">
          <SectionTitle letter="B" id="h-summary" title="Research summary" hint="AI-written interpretation of the findings below — not itself a verified fact." />
          <p className="font-display max-w-[760px] text-[21px] leading-[1.5] text-ink">{p.summary}</p>
        </section>

        {/* C — findings */}
        <section id="verified" aria-labelledby="h-verified">
          <SectionTitle
            letter="C"
            id="h-verified"
            title="Verified information"
            hint="Public professional findings, each linked to the sources returned by the web search."
          />
          <div className="mb-3">
            <StatusLegend />
          </div>
          {brief.findings.length ? (
            <ul>
              {brief.findings.map((f) => (
                <FindingRow key={f.id} f={f} sources={brief.sources} highlight={highlight === f.id} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No source-backed findings were returned.</p>
          )}
          {brief.sources.length > 0 && (
            <div className="mt-8">
              <div className="eyebrow mb-2">Sources</div>
              <SourceList sources={brief.sources} usedIds={usedSourceIds} />
            </div>
          )}
          {!compact && <FollowupBox brief={brief} onDone={(f) => applyFollowup(brief.id, f)} />}
        </section>

        {/* D — customer-provided */}
        <section id="customer" aria-labelledby="h-customer">
          <SectionTitle letter="D" id="h-customer" title="Customer-provided information" />
          <div className="rounded-[4px] border border-brass/30 bg-brass-wash/50 p-5" data-testid="customer-provided">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="brass">Provided by the prospect</Badge>
              <span className="text-[11.5px] text-muted">
                Not verified by research.{" "}
                {cp.sharedWithAI ? "Included in the AI analysis." : "Not shared with the AI."}
              </span>
            </div>
            {hasCustomer ? (
              <dl className="grid gap-4 text-[13.5px] sm:grid-cols-3">
                {(
                  [
                    ["Clothing interest", cp.clothingInterest],
                    ["Stated budget", cp.statedBudget],
                    ["Notes", cp.notes],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="eyebrow">{k}</dt>
                    <dd className={cn("mt-1 leading-relaxed", v ? "text-ink" : "text-faint italic")}>{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[13px] text-muted">No interest-card details were entered.</p>
            )}
          </div>
        </section>

        {/* E — gaps */}
        <section id="gaps" aria-labelledby="h-gaps">
          <SectionTitle letter="E" id="h-gaps" title="Information gaps" hint="What you may still need to learn." />
          {brief.missingInformation.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {brief.missingInformation.map((m) => (
                <li key={m} className="flex gap-3 rounded-[3px] border border-dashed border-hairline px-4 py-3 text-[13.5px] text-ink-soft">
                  <span className="text-brass" aria-hidden>
                    ?
                  </span>
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No gaps listed.</p>
          )}
        </section>

        {/* F — preparation */}
        <section id="preparation" aria-labelledby="h-prep">
          <SectionTitle
            letter="F"
            id="h-prep"
            title="Preparation insights"
            hint="AI interpretation grounded in the findings and the interest card. No assumptions about wealth or personal characteristics."
          />
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Consultation context</div>
              <ul className="space-y-3">
                {brief.preparationInsights.map((m) => (
                  <li key={m} className="border-l-2 border-brass-soft pl-4 text-[13.5px] leading-relaxed text-ink">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow mb-2">Questions you might ask</div>
              <ol className="space-y-3">
                {brief.suggestedQuestions.map((q, i) => (
                  <li key={q} className="flex gap-3 text-[13.5px] leading-relaxed text-ink">
                    <span className="font-display text-[16px] text-brass">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* G — options */}
        <section id="options" aria-labelledby="h-options">
          <SectionTitle letter="G" id="h-options" title="Next-step options" />
          <OptionCards brief={brief} onJumpToFinding={jump} />
        </section>

        <UsageLine usage={brief.usage} />
      </div>
    </div>
  );
}

/* Bounded additional research on one aspect. One web search per request. */
export function FollowupBox({ brief, onDone }: { brief: ProspectBrief; onDone: (f: Awaited<ReturnType<ReturnType<typeof clientFor>["followup"]>>) => void }) {
  const [aspect, setAspect] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const run = async (text = aspect) => {
    if (text.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const f = await clientFor(brief.mode).followup(brief, text.trim());
      onDone(f);
      setLast(`${f.summary}${f.findings.length ? ` (${f.findings.length} new finding${f.findings.length === 1 ? "" : "s"} added)` : ""}`);
      setAspect("");
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Request failed", retryable: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-8 p-5">
      <div className="eyebrow mb-1">Research another aspect</div>
      <p className="mb-3 text-[12.5px] text-muted">
        One additional, bounded web search about this person&apos;s public professional background.
        {brief.mode === "demo" && " (Live Mode only — Demo Mode shows how it works.)"}
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Input
          aria-label="Aspect to research"
          placeholder="e.g. board memberships or recent speaking engagements"
          value={aspect}
          onChange={(e) => setAspect(e.target.value)}
          maxLength={240}
          disabled={busy}
        />
        <Button type="submit" variant="outline" disabled={busy || aspect.trim().length < 3}>
          <Search /> {busy ? "Searching…" : "Research"}
        </Button>
      </form>
      {busy && <div className="skeleton mt-3 h-3 w-2/3" />}
      {last && (
        <p role="status" className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-soft">
          {last}
          <button onClick={() => setLast(null)} aria-label="Dismiss" className="text-faint hover:text-ink">
            <X className="size-3.5" />
          </button>
        </p>
      )}
      {error && (
        <div className="mt-3">
          <ErrorPanel error={error} onRetry={() => run()} context="Additional research failed" />
        </div>
      )}
    </Card>
  );
}
