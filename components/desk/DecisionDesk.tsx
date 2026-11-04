"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Eye, MessageSquareText, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AssistantSheet } from "@/components/research/Assistant";
import { FollowupBox } from "@/components/research/BriefView";
import { OptionCards } from "@/components/research/OptionCards";
import { Card, EmptyState, FindingRow, PageHeader, SampleTag, SourceChips, StatusBadge, StatusLegend } from "@/components/research/bits";
import { ConfidenceBadge } from "@/components/discover/DiscoverWorkspace";
import { MAX_COMPARE, type SavedItem, visibleSaved } from "@/lib/decisions";
import type { DiscoveryResult, ProspectBrief, VerificationStatus } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { CrmNote, EmailDraft } from "./Drafts";

type Resolved =
  | { item: SavedItem; kind: "brief"; brief: ProspectBrief; name: string }
  | { item: SavedItem; kind: "discovery"; disc: DiscoveryResult; name: string };

function useResolved(items: SavedItem[]): Resolved[] {
  const briefs = useDesk((s) => s.briefs);
  const discoveries = useDesk((s) => s.discoveries);
  return useMemo(
    () =>
      items.flatMap((item): Resolved[] => {
        if (item.kind === "brief") {
          const brief = briefs[item.refId];
          return brief ? [{ item, kind: "brief", brief, name: brief.professionalProfile.name }] : [];
        }
        const disc = discoveries[item.refId];
        return disc ? [{ item, kind: "discovery", disc, name: disc.person }] : [];
      }),
    [items, briefs, discoveries],
  );
}

function counts(statuses: VerificationStatus[]) {
  const c: Record<VerificationStatus, number> = { corroborated: 0, "single-source": 0, conflicting: 0, unverified: 0 };
  for (const s of statuses) c[s]++;
  return c;
}

function StatusCounts({ statuses }: { statuses: VerificationStatus[] }) {
  const c = counts(statuses);
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(c) as VerificationStatus[])
        .filter((k) => c[k] > 0)
        .map((k) => (
          <span key={k} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
            <StatusBadge status={k} /> ×{c[k]}
          </span>
        ))}
      {statuses.length === 0 && <span className="text-[12px] text-faint italic">No findings</span>}
    </div>
  );
}

/* Evidence drawer for one profile */
function EvidenceSheet({ r }: { r: Resolved }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <Eye /> Evidence
        </Button>
      </SheetTrigger>
      <SheetContent title={`Evidence — ${r.name}`} description="Every claim with its status and the sources the web search returned.">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3">
            <StatusLegend />
          </div>
          {r.kind === "brief" ? (
            <ul>
              {r.brief.findings.map((f) => (
                <FindingRow key={f.id} f={f} sources={r.brief.sources} />
              ))}
            </ul>
          ) : (
            <ul className="space-y-4">
              {r.disc.evidence.map((e) => (
                <li key={e.claim} className="border-t border-hairline-soft pt-3 first:border-0">
                  <div className="flex items-start justify-between gap-3 text-[13.5px]">
                    {e.claim} <StatusBadge status={e.verificationStatus} />
                  </div>
                  <div className="mt-1.5">
                    <SourceChips ids={e.sourceIds} sources={r.disc.sources} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Comparison({ rows, objective, onOpen, onResearch }: { rows: Resolved[]; objective: string; onOpen: (r: Resolved) => void; onResearch: (d: DiscoveryResult) => void }) {
  const toggleCompare = useDesk((s) => s.toggleCompare);
  const ROWS: { label: string; render: (r: Resolved) => React.ReactNode }[] = [
    {
      label: "Verified professional background",
      render: (r) => {
        const fs = r.kind === "brief" ? r.brief.findings.filter((f) => f.verificationStatus !== "unverified") : r.disc.evidence;
        return fs.length ? (
          <ul className="space-y-1.5">
            {fs.slice(0, 4).map((f) => (
              <li key={f.claim} className="text-[12.5px] leading-snug">
                {f.claim}{" "}
                <span className="text-[10.5px] text-faint uppercase">({f.verificationStatus})</span>
              </li>
            ))}
            {fs.length > 4 && <li className="text-[11.5px] text-faint">+{fs.length - 4} more</li>}
          </ul>
        ) : (
          <span className="text-[12px] text-faint italic">Nothing source-backed yet</span>
        );
      },
    },
    {
      label: `Relevance to objective`,
      render: (r) =>
        r.kind === "brief" ? (
          <div className="space-y-1.5 text-[12.5px] leading-snug">
            {r.brief.customerProvided.clothingInterest ? (
              <p>
                <span className="eyebrow mr-1">Card</span>
                {r.brief.customerProvided.clothingInterest}
              </p>
            ) : (
              <p className="text-faint italic">No interest card</p>
            )}
            {r.brief.preparationInsights[0] && <p className="text-ink-soft">{r.brief.preparationInsights[0]}</p>}
          </div>
        ) : (
          <div className="space-y-1.5 text-[12.5px] leading-snug">
            <p>{r.disc.relevanceExplanation}</p>
            <p className="text-faint italic">No interest card — surfaced by discovery</p>
          </div>
        ),
    },
    {
      label: "Available information",
      render: (r) => (
        <div className="space-y-2">
          <StatusCounts
            statuses={r.kind === "brief" ? r.brief.findings.map((f) => f.verificationStatus) : r.disc.evidence.map((e) => e.verificationStatus)}
          />
          <div className="text-[11.5px] text-muted">
            {(r.kind === "brief" ? r.brief.sources : r.disc.sources).length} sources ·{" "}
            {r.kind === "brief" ? "full brief" : <ConfidenceBadge c={r.disc.identityConfidence} />}
          </div>
        </div>
      ),
    },
    {
      label: "Missing information",
      render: (r) => {
        const gaps = r.kind === "brief" ? r.brief.missingInformation : r.disc.researchGaps;
        return gaps.length ? (
          <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-soft">
            {gaps.slice(0, 4).map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : (
          <span className="text-[12px] text-faint">None listed</span>
        );
      },
    },
    {
      label: "Possible next steps",
      render: (r) =>
        r.kind === "brief" ? (
          <ul className="space-y-0.5 text-[12.5px]">
            {r.brief.suggestedActions.map((a) => (
              <li key={a.id}>· {a.title}</li>
            ))}
          </ul>
        ) : (
          <span className="text-[12.5px] text-ink-soft">Run full research before considering outreach.</span>
        ),
    },
  ];

  return (
    <div className="overflow-x-auto" data-testid="comparison">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Comparison of selected profiles for: {objective}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[170px] border-b border-hairline pb-4 align-bottom">
              <span className="eyebrow">Objective</span>
              <div className="mt-1 text-[12.5px] font-normal text-ink-soft">{objective}</div>
            </th>
            {rows.map((r) => (
              <th key={r.item.id} scope="col" className="border-b border-hairline px-4 pb-4 align-bottom font-normal">
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.item.mode === "demo" && <SampleTag />}
                  <Badge tone={r.kind === "brief" ? "navy" : "slate"}>{r.kind === "brief" ? "Brief" : "Discovery"}</Badge>
                </div>
                <div className="font-display mt-2 text-[22px] leading-tight text-ink">{r.name}</div>
                <div className="text-[12px] text-muted">
                  {r.kind === "brief"
                    ? [r.brief.professionalProfile.role, r.brief.professionalProfile.organization].filter(Boolean).join(", ")
                    : `${r.disc.professionalRole}, ${r.disc.organization}`}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="border-b border-hairline-soft py-4 pr-4 align-top text-[12px] font-medium text-ink-soft">
                {row.label}
              </th>
              {rows.map((r) => (
                <td key={r.item.id} className="border-b border-hairline-soft px-4 py-4 align-top text-ink">
                  {row.render(r)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-4 pr-4 align-top text-[12px] font-medium text-ink-soft">
              Inspect
            </th>
            {rows.map((r) => (
              <td key={r.item.id} className="px-4 py-4 align-top">
                <div className="flex flex-wrap gap-1">
                  <EvidenceSheet r={r} />
                  {r.kind === "brief" ? (
                    <Button size="sm" variant="outline" onClick={() => onOpen(r)}>
                      Decide
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onResearch(r.disc)}>
                      <Search /> Research
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleCompare(r.item.id)} aria-label={`Remove ${r.name} from comparison`}>
                    Remove
                  </Button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[11.5px] text-faint">
        No ranking or score is calculated. The columns lay out what is known and unknown so you can judge for yourself.
      </p>
    </div>
  );
}

function FocusPanel({ brief, onClose }: { brief: ProspectBrief; onClose: () => void }) {
  const applyFollowup = useDesk((s) => s.applyFollowup);
  const setSession = useDesk((s) => s.setSession);
  const router = useRouter();
  return (
    <section className="animate-rise space-y-8" aria-labelledby="focus-title" data-testid="focus-panel">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <div className="eyebrow">Decide</div>
          <h2 id="focus-title" className="font-display text-[34px] leading-tight text-ink">
            {brief.professionalProfile.name}
          </h2>
          <p className="text-[13px] text-muted">
            {[brief.professionalProfile.role, brief.professionalProfile.organization].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSession({ input: brief.input, shareCustomerDetails: brief.customerProvided.sharedWithAI, phase: "done", briefId: brief.id });
              router.push("/research");
            }}
          >
            Open full brief
          </Button>
          <AssistantSheet
            context={{ briefs: [brief], discoveries: [] }}
            onFollowup={(f) => applyFollowup(brief.id, f)}
            trigger={
              <Button size="sm" variant="outline">
                <MessageSquareText /> Ask the AI
              </Button>
            }
          />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Back to comparison
          </Button>
        </div>
      </div>
      <OptionCards brief={brief} />
      <div className="grid gap-6 xl:grid-cols-2">
        <EmailDraft brief={brief} />
        <CrmNote brief={brief} />
      </div>
      <FollowupBox brief={brief} onDone={(f) => applyFollowup(brief.id, f)} />
    </section>
  );
}

export function DecisionDesk() {
  const router = useRouter();
  const mode = useDesk((s) => s.mode);
  const saved = useDesk((s) => s.saved);
  const compare = useDesk((s) => s.compare[s.mode]);
  const toggleCompare = useDesk((s) => s.toggleCompare);
  const setStatus = useDesk((s) => s.setStatus);
  const allDecisions = useDesk((s) => s.decisions);
  const decisions = useMemo(() => allDecisions.filter((d) => d.mode === mode), [allDecisions, mode]);
  const queueResearch = useDesk((s) => s.queueResearch);
  const setSession = useDesk((s) => s.setSession);
  const resetMode = useDesk((s) => s.resetMode);
  const setMode = useDesk((s) => s.setMode);
  const [tab, setTab] = useState<"active" | "dismissed">("active");
  const [objective, setObjective] = useState("Prepare for possible consultations");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const list = useResolved(visibleSaved(saved, mode, tab));
  const comparedItems = useResolved(compare.map((id) => saved.find((s) => s.id === id)).filter((s): s is SavedItem => Boolean(s)));
  const focus = useResolved(saved.filter((s) => s.id === focusId)).find((r) => r.kind === "brief");

  const research = (d: DiscoveryResult) => {
    setSession(undefined);
    queueResearch({ fullName: d.person, company: d.organization, region: d.region });
    router.push("/research");
  };

  const assistCtx = {
    briefs: comparedItems.filter((r) => r.kind === "brief").map((r) => (r as Extract<Resolved, { kind: "brief" }>).brief),
    discoveries: comparedItems.filter((r) => r.kind === "discovery").map((r) => (r as Extract<Resolved, { kind: "discovery" }>).disc),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace III"
        title="Decision Desk"
        lede="Compare up to three profiles side by side, inspect the evidence behind each, and prepare drafts. The desk lays out options; you make the decision."
        step={focus ? "Decide" : "Compare"}
      />

      <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
        <aside aria-label="Saved research" className="space-y-4">
          <div role="tablist" aria-label="Saved items" className="flex gap-4 border-b border-hairline text-[12.5px]">
            {(["active", "dismissed"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("-mb-px border-b-2 pb-2 capitalize", tab === t ? "border-brass text-ink" : "border-transparent text-muted")}
              >
                {t === "active" ? "Saved" : "Dismissed"} ({visibleSaved(saved, mode, t).length})
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              {tab === "active"
                ? "Nothing saved yet. Save a brief from Research Prospect or a profile from Discover."
                : "No dismissed items."}
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((r) => {
                const inCompare = compare.includes(r.item.id);
                return (
                  <li key={r.item.id} className={cn("rounded-[3px] border bg-raised p-3", inCompare ? "border-navy" : "border-hairline")} data-testid="saved-item">
                    <div className="flex items-start gap-3">
                      {tab === "active" && (
                        <input
                          type="checkbox"
                          aria-label={`Compare ${r.name}`}
                          checked={inCompare}
                          onChange={() => {
                            const ok = toggleCompare(r.item.id);
                            setLimitMsg(ok ? null : `You can compare up to ${MAX_COMPARE} profiles at a time.`);
                          }}
                          className="mt-1 size-4 accent-[var(--navy)]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink">{r.name}</div>
                        <div className="truncate text-[11.5px] text-muted">
                          {r.kind === "brief"
                            ? r.brief.professionalProfile.organization ?? "Brief"
                            : `${r.disc.organization} · discovery`}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tab === "active" ? (
                            <>
                              {r.kind === "brief" ? (
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setFocusId(r.item.id)}>
                                  Decide
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => research(r.disc)}>
                                  Research
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted" onClick={() => setStatus(r.item.id, "dismissed")}>
                                <Trash2 /> Dismiss
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setStatus(r.item.id, "active")}>
                              <ArchiveRestore /> Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {limitMsg && (
            <p role="status" className="text-[12px] text-oxblood">
              {limitMsg}
            </p>
          )}

          <div className="border-t border-hairline pt-4">
            <div className="eyebrow mb-2">Decision log</div>
            {decisions.length === 0 ? (
              <p className="text-[12px] text-faint">No decisions recorded yet.</p>
            ) : (
              <ol className="space-y-2" data-testid="decision-log">
                {decisions.slice(0, 8).map((d) => (
                  <li key={d.id} className="text-[12px] leading-snug">
                    <span className="text-ink">{d.subjectName}</span> — {d.choice}
                    {d.note && <span className="text-muted"> · {d.note}</span>}
                    <div className="text-[10.5px] text-faint">{new Date(d.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="border-t border-hairline pt-4">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted"
              onClick={() => {
                if (window.confirm(`Clear all ${mode === "demo" ? "sample" : "live"} research, saved items and decisions from this browser?`)) {
                  resetMode();
                  setFocusId(null);
                  if (mode === "demo") setMode("demo");
                }
              }}
            >
              {mode === "demo" ? "Reset sample desk" : "Clear live session"}
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          {focus && focus.kind === "brief" ? (
            <FocusPanel brief={focus.brief} onClose={() => setFocusId(null)} />
          ) : comparedItems.length === 0 ? (
            <EmptyState title="Select profiles to compare">
              Tick up to three saved items on the left. Briefs and discovery profiles can be compared side by side.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="w-full max-w-[420px]">
                  <Label htmlFor="objective">Research objective</Label>
                  <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={140} />
                </div>
                <AssistantSheet
                  context={assistCtx}
                  trigger={
                    <Button variant="outline">
                      <MessageSquareText /> Ask about these profiles
                    </Button>
                  }
                />
              </div>
              <Card className="p-5">
                <Comparison
                  rows={comparedItems}
                  objective={objective}
                  onOpen={(r) => setFocusId(r.item.id)}
                  onResearch={research}
                />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
