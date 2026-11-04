"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Columns3, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ClientError, clientFor } from "@/lib/client/api";
import { DiscoveryRequestSchema, type ApiError, type DiscoveryResult } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { Card, EmptyState, ErrorPanel, PageHeader, SampleTag, SourceChips, StatusBadge, UsageLine } from "@/components/research/bits";

const ROLE_PRESETS = [
  "CEO",
  "President",
  "Founder",
  "Managing Partner",
  "Chief Financial Officer",
  "Executive Director",
  "Physician practice leader",
  "Law firm partner",
];

const CONFIDENCE_TONE = { high: "sage", medium: "amber", low: "slate" } as const;

export function ConfidenceBadge({ c }: { c: DiscoveryResult["identityConfidence"] }) {
  return (
    <Badge tone={CONFIDENCE_TONE[c.level]} title={c.reason}>
      {c.level} identity confidence
    </Badge>
  );
}

export function DiscoveryCard({ d, onResearch }: { d: DiscoveryResult; onResearch: () => void }) {
  const saved = useDesk((s) => s.saved);
  const save = useDesk((s) => s.save);
  const setStatus = useDesk((s) => s.setStatus);
  const toggleCompare = useDesk((s) => s.toggleCompare);
  const compare = useDesk((s) => s.compare[s.mode]);
  const [msg, setMsg] = useState<string | null>(null);
  const savedId = `discovery:${d.id}`;
  const isSaved = saved.some((s) => s.id === savedId && s.status === "active");

  return (
    <Card className="flex flex-col p-5 animate-rise" data-testid="discovery-card">
      <div className="flex flex-wrap items-center gap-2">
        {d.mode === "demo" && <SampleTag />}
        <ConfidenceBadge c={d.identityConfidence} />
      </div>
      <h3 className="font-display mt-3 text-[25px] leading-tight text-ink">{d.person}</h3>
      <div className="text-[13.5px] text-ink-soft">
        {d.professionalRole}, {d.organization}
      </div>
      <div className={cn("text-[12.5px]", d.region ? "text-muted" : "text-faint italic")}>{d.region ?? "Region not verified"}</div>

      <div className="mt-4">
        <div className="eyebrow mb-1">Why surfaced</div>
        <p className="text-[13px] leading-relaxed text-ink-soft">{d.relevanceExplanation}</p>
      </div>
      <div className="mt-4">
        <div className="eyebrow mb-1.5">Evidence</div>
        <ul className="space-y-2.5">
          {d.evidence.map((e) => (
            <li key={e.claim} className="text-[13px] leading-snug text-ink">
              <div className="flex items-start justify-between gap-3">
                <span>{e.claim}</span>
                <StatusBadge status={e.verificationStatus} />
              </div>
              <div className="mt-1">
                <SourceChips ids={e.sourceIds} sources={d.sources} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-[11.5px] text-muted italic">Confidence: {d.identityConfidence.reason}</p>
      {d.researchGaps.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-1">Gaps</div>
          <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-soft">
            {d.researchGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button size="sm" onClick={onResearch}>
          <Search /> Research this person
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => (isSaved ? setStatus(savedId, "dismissed") : save("discovery", d.id))}
        >
          {isSaved ? <BookmarkCheck /> : <Bookmark />} {isSaved ? "Saved" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            save("discovery", d.id);
            setMsg(toggleCompare(savedId) ? null : "Up to 3 profiles can be compared.");
          }}
        >
          <Columns3 /> {compare.includes(savedId) ? "Comparing" : "Compare"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-[12px] text-oxblood">{msg}</p>}
    </Card>
  );
}

export function DiscoverWorkspace() {
  const router = useRouter();
  const mode = useDesk((s) => s.mode);
  const last = useDesk((s) => s.lastDiscovery[s.mode]);
  const putDiscovery = useDesk((s) => s.putDiscovery);
  const queueResearch = useDesk((s) => s.queueResearch);
  const setSession = useDesk((s) => s.setSession);

  const [region, setRegion] = useState(last?.request.region ?? "Indianapolis metro area");
  const [roles, setRoles] = useState<string[]>(last?.request.roles ?? ["CEO", "President", "Managing Partner"]);
  const [custom, setCustom] = useState("");
  const [industry, setIndustry] = useState(last?.request.industry ?? "");
  const [limit, setLimit] = useState<5 | 10>(last?.request.resultLimit ?? 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleRole = (r: string) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : rs.length >= 6 ? rs : [...rs, r]));

  const run = async () => {
    const parsed = DiscoveryRequestSchema.safeParse({ region, roles, industry, resultLimit: limit });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setFormError(null);
    setError(null);
    setBusy(true);
    const m = mode;
    try {
      const r = await clientFor(m).discover(parsed.data);
      putDiscovery(r);
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Request failed", retryable: true });
    } finally {
      setBusy(false);
    }
  };

  const research = (d: DiscoveryResult) => {
    setSession(undefined);
    queueResearch({ fullName: d.person, company: d.organization, region: d.region });
    router.push("/research");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace II"
        title="Discover Professionals"
        lede="Find a small shortlist of named professionals whose public roles match what you describe — from official leadership pages, business organizations and the business press. Only people supported by sources are shown."
        step={last ? "Explore" : "Observe"}
      />

      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="grid gap-6 lg:grid-cols-[1fr_1fr_auto]"
        >
          <fieldset disabled={busy} className="contents">
            <div className="space-y-4">
              <div>
                <Label htmlFor="region">City or metro area</Label>
                <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="industry">Industry (optional)</Label>
                <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. law, banking, healthcare" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink-soft" id="roles-label">
                Professional roles <span className="font-normal text-faint">(up to 6)</span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="roles-label">
                {[...new Set([...ROLE_PRESETS, ...roles])].map((r) => {
                  const on = roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleRole(r)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12px] transition-colors",
                        on ? "border-navy bg-navy text-paper" : "border-hairline bg-raised text-ink-soft hover:border-brass",
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  aria-label="Add a role"
                  placeholder="Add a role"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (custom.trim().length > 1) toggleRole(custom.trim());
                      setCustom("");
                    }
                  }}
                  className="h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  aria-label="Add role"
                  onClick={() => {
                    if (custom.trim().length > 1) toggleRole(custom.trim());
                    setCustom("");
                  }}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-4">
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-ink-soft" id="limit-label">
                  Maximum results
                </div>
                <div role="radiogroup" aria-labelledby="limit-label" className="flex rounded-[3px] border border-hairline bg-raised p-[3px]">
                  {([5, 10] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={limit === n}
                      onClick={() => setLimit(n)}
                      className={cn("flex-1 rounded-[2px] px-5 py-1.5 text-[13px]", limit === n ? "bg-navy text-paper" : "text-muted")}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" size="lg" disabled={busy}>
                <Search /> {busy ? "Searching…" : "Find professionals"}
              </Button>
            </div>
          </fieldset>
        </form>
        {formError && (
          <p role="alert" className="mt-3 text-[12.5px] text-oxblood">
            {formError}
          </p>
        )}
        <p className="mt-4 text-[11.5px] text-faint">
          Sources: official company and organization pages, business publications and professional biographies. LinkedIn,
          social media and people-search sites are never used. No one is contacted.
        </p>
      </Card>

      <div className="mt-10" aria-live="polite">
        {busy && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-72" />
            ))}
          </div>
        )}
        {!busy && error && <ErrorPanel error={error} onRetry={run} context="Discovery could not be completed" />}
        {!busy && !error && last && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="font-display text-[28px] text-ink">
                  {last.results.length} {last.results.length === 1 ? "profile" : "profiles"} found
                  <span className="ml-2 text-[15px] text-muted">of up to {last.request.resultLimit} requested</span>
                </h2>
                <p className="text-[12.5px] text-muted">
                  {last.request.roles.join(", ")} · {last.request.region}
                  {last.request.industry ? ` · ${last.request.industry}` : ""}
                </p>
              </div>
              <UsageLine usage={last.usage} />
            </div>
            {last.results.length < last.request.resultLimit && last.results.length > 0 && (
              <p className="rounded-[3px] border border-hairline bg-sunk/60 px-4 py-3 text-[12.5px] text-ink-soft" data-testid="fewer-notice">
                Fewer credible profiles were found than requested. Only people whose role is supported by a source are
                shown — none have been added to fill the list.
              </p>
            )}
            {(last.note || last.systemNotes.length > 0) && (
              <ul className="space-y-1 text-[12px] text-muted">
                {last.note && <li>· {last.note}</li>}
                {last.systemNotes.map((n) => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            )}
            {last.results.length === 0 ? (
              <EmptyState title="No credible profiles found">
                The search could not support any named professionals for this request. Try a broader role list or a
                larger area.
              </EmptyState>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {last.results.map((d) => (
                  <DiscoveryCard key={d.id} d={d} onResearch={() => research(d)} />
                ))}
              </div>
            )}
          </div>
        )}
        {!busy && !error && !last && (
          <EmptyState title="No search yet">
            Describe the roles and area you are interested in. Results are a starting point for research, not a list of
            customers.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

