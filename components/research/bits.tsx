"use client";

import { AlertTriangle, ArrowUpRight, CircleDashed, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiError, ResearchFinding, ResearchSource, Usage, VerificationStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/* ── Philosophy rail: Observe → Investigate → Explore → Compare → Decide ── */

export const LOOP = ["Observe", "Investigate", "Explore", "Compare", "Decide"] as const;
export type LoopStep = (typeof LOOP)[number];

export function LoopRail({ current, className }: { current: LoopStep; className?: string }) {
  const idx = LOOP.indexOf(current);
  return (
    <ol aria-label="Decision process" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]", className)}>
      {LOOP.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === idx ? "step" : undefined}>
          <span
            className={cn(
              "tracking-[0.14em] uppercase transition-colors",
              i === idx ? "font-semibold text-brass" : i < idx ? "text-ink-soft" : "text-faint",
            )}
          >
            {s}
          </span>
          {i < LOOP.length - 1 && <span className="h-px w-4 bg-hairline" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  step,
  aside,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  step: LoopStep;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-[720px]">
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="font-display text-[38px] leading-[1.05] font-medium text-ink sm:text-[46px]">{title}</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">{lede}</p>
        <LoopRail current={step} className="mt-5" />
      </div>
      {aside}
    </div>
  );
}

export function SectionTitle({ letter, title, hint, id }: { letter?: string; title: string; hint?: string; id?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        {letter && <span className="font-display text-[15px] text-brass italic">{letter}</span>}
        <h2 id={id} className="font-display text-[24px] leading-tight font-medium text-ink">
          {title}
        </h2>
      </div>
      {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
      <div className="rule-brass mt-3" />
    </div>
  );
}

/* ── Verification status ─────────────────────────────────────── */

const STATUS: Record<VerificationStatus, { label: string; tone: "sage" | "amber" | "oxblood" | "slate"; help: string }> = {
  corroborated: { label: "Corroborated", tone: "sage", help: "Linked to sources on two or more independent websites." },
  "single-source": { label: "Single source", tone: "amber", help: "Linked to one website only. Open it to confirm." },
  conflicting: { label: "Conflicting", tone: "oxblood", help: "Sources disagree. Check before relying on it." },
  unverified: { label: "Unverified", tone: "slate", help: "No source was linked. Treat as unconfirmed." },
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} title={s.help} data-status={status}>
      {s.label}
    </Badge>
  );
}

export function StatusLegend() {
  return (
    <details className="group text-[12px] text-muted">
      <summary className="cursor-pointer list-none select-none hover:text-ink">
        <span className="underline decoration-dotted underline-offset-4">How verification status is decided</span>
      </summary>
      <div className="mt-3 grid gap-2 rounded-[3px] border border-hairline bg-raised p-4 sm:grid-cols-2">
        {(Object.keys(STATUS) as VerificationStatus[]).map((k) => (
          <div key={k} className="flex items-start gap-2">
            <StatusBadge status={k} />
            <span className="leading-snug">{STATUS[k].help}</span>
          </div>
        ))}
        <p className="leading-snug sm:col-span-2">
          Status is assigned by the application from the sources the web search actually returned — never by the AI
          on its own. Even corroborated claims should be checked at the source before you rely on them.
        </p>
      </div>
    </details>
  );
}

/* ── Sources ─────────────────────────────────────────────────── */

export function SourceChip({ source }: { source: ResearchSource }) {
  const content = (
    <>
      <span className="font-semibold text-brass tabular-nums">{source.id}</span>
      <span className="max-w-[200px] truncate">{source.publisher ?? source.title}</span>
    </>
  );
  const cls =
    "inline-flex max-w-full items-center gap-1.5 rounded-[2px] border border-hairline bg-raised px-1.5 py-[2px] text-[11px] text-ink-soft";
  if (source.sample) {
    return (
      <span className={cn(cls, "border-dashed")} title={`Fictional sample source: ${source.title}`} data-testid="source-chip">
        {content}
        <span className="text-[9.5px] tracking-[0.1em] text-brass uppercase">sample</span>
      </span>
    );
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={`${source.title} — ${source.url}`}
      className={cn(cls, "transition-colors hover:border-brass hover:text-navy")}
      data-testid="source-chip"
    >
      {content}
      <ArrowUpRight className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function SourceChips({ ids, sources }: { ids: string[]; sources: ResearchSource[] }) {
  const list = ids.map((id) => sources.find((s) => s.id === id)).filter((s): s is ResearchSource => Boolean(s));
  if (!list.length) return <span className="text-[11px] text-faint italic">No source linked</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <SourceChip key={s.id} source={s} />
      ))}
    </span>
  );
}

export function SourceList({ sources, usedIds }: { sources: ResearchSource[]; usedIds: Set<string> }) {
  const used = sources.filter((s) => usedIds.has(s.id));
  const other = sources.filter((s) => !usedIds.has(s.id));
  const Row = ({ s }: { s: ResearchSource }) => (
    <li className="flex items-start gap-3 border-t border-hairline-soft py-2.5 first:border-t-0">
      <span className="w-7 shrink-0 pt-px text-[11px] font-semibold text-brass tabular-nums">{s.id}</span>
      <div className="min-w-0">
        {s.sample ? (
          <span className="text-[13px] text-ink">{s.title}</span>
        ) : (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[13px] text-navy underline decoration-hairline underline-offset-4 hover:decoration-brass"
          >
            {s.title}
          </a>
        )}
        <div className="truncate text-[11.5px] text-muted">
          {s.sample ? `${s.url} · fictional sample source` : s.url}
          {s.publishedAt ? ` · published ${s.publishedAt}` : ""}
        </div>
      </div>
    </li>
  );
  return (
    <div className="space-y-4">
      <ul>{used.map((s) => <Row key={s.id} s={s} />)}</ul>
      {other.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">
            {other.length} other page{other.length === 1 ? "" : "s"} the search consulted but no finding relies on
          </summary>
          <ul className="mt-2">{other.map((s) => <Row key={s.id} s={s} />)}</ul>
        </details>
      )}
    </div>
  );
}

/* ── Findings ────────────────────────────────────────────────── */

const CATEGORY_LABEL: Record<ResearchFinding["category"], string> = {
  role: "Role",
  organization: "Organization",
  company: "Company",
  career: "Career",
  affiliation: "Affiliation",
  accomplishment: "Recognition",
  other: "Other",
};

export function FindingRow({ f, sources, highlight }: { f: ResearchFinding; sources: ResearchSource[]; highlight?: boolean }) {
  return (
    <li
      id={`finding-${f.id}`}
      data-testid="finding"
      className={cn(
        "grid gap-x-4 gap-y-2 border-t border-hairline-soft py-3.5 first:border-t-0 sm:grid-cols-[44px_1fr_auto]",
        highlight && "bg-brass-wash/60",
      )}
    >
      <span className="text-[11px] font-semibold text-faint tabular-nums">{f.id}</span>
      <div className="min-w-0">
        <div className="mb-1 text-[10.5px] tracking-[0.12em] text-faint uppercase">{CATEGORY_LABEL[f.category]}</div>
        <p className="text-[14px] leading-relaxed text-ink">{f.claim}</p>
        {f.uncertaintyNote && <p className="mt-1 text-[12.5px] text-muted italic">{f.uncertaintyNote}</p>}
        <div className="mt-2">
          <SourceChips ids={f.sourceIds} sources={sources} />
        </div>
      </div>
      <div className="sm:pt-5">
        <StatusBadge status={f.verificationStatus} />
      </div>
    </li>
  );
}

/* ── States ──────────────────────────────────────────────────── */

export function ErrorPanel({ error, onRetry, context }: { error: ApiError; onRetry?: () => void; context?: string }) {
  return (
    <div role="alert" data-testid="error-panel" className="rounded-[3px] border border-oxblood/30 bg-oxblood-wash/60 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-oxblood" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-oxblood">{context ?? "Research could not be completed"}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{error.message}</p>
          <p className="mt-2 text-[11.5px] text-muted">
            No sample data was substituted. Error code: <code>{error.code}</code>
          </p>
          {onRetry && error.retryable && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              <RotateCcw /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[3px] border border-dashed border-hairline px-6 py-10 text-center">
      <CircleDashed className="mx-auto mb-3 size-5 text-faint" aria-hidden />
      <div className="font-display text-[22px] text-ink">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-[460px] text-[13px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function UsageLine({ usage }: { usage?: Usage }) {
  if (!usage) return null;
  return (
    <p className="text-[11px] text-faint tabular-nums" data-testid="usage-line">
      {usage.model} · {usage.calls} model call{usage.calls === 1 ? "" : "s"} · {usage.webSearchCalls} web search
      {usage.webSearchCalls === 1 ? "" : "es"} · {usage.inputTokens.toLocaleString()} in /{" "}
      {usage.outputTokens.toLocaleString()} out tokens
      {usage.reasoningTokens ? ` (${usage.reasoningTokens.toLocaleString()} reasoning)` : ""} ·{" "}
      {(usage.durationMs / 1000).toFixed(1)}s
    </p>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <Badge tone="brass" className={className}>
      Sample data
    </Badge>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[4px] border border-hairline bg-raised shadow-card", className)} {...props} />;
}
