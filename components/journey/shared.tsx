"use client";

import { Check } from "lucide-react";
import type { JourneyMilestone } from "@/lib/journey/schemas";
import { cn } from "@/lib/utils";

/* Small building blocks shared by both perspectives. */

export function Chip({
  selected,
  onClick,
  children,
  swatch,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  swatch?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition-all duration-200",
        selected ? "border-navy bg-navy text-paper shadow-card" : "border-hairline bg-raised text-ink-soft hover:border-brass hover:text-ink",
      )}
    >
      {swatch && (
        <span
          aria-hidden
          className={cn("size-3.5 rounded-full border", selected ? "border-paper/60" : "border-hairline")}
          style={{ background: swatch }}
        />
      )}
      {children}
      {selected && <Check className="size-3.5" aria-hidden />}
    </button>
  );
}

export function ChoiceCard({
  selected,
  onClick,
  title,
  hint,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex flex-col items-start rounded-[4px] border px-4 py-3.5 text-left transition-all duration-200",
        selected ? "border-navy bg-navy text-paper shadow-card" : "border-hairline bg-raised hover:border-brass",
      )}
    >
      <span className="font-display text-[19px] leading-tight">{title}</span>
      {hint && <span className={cn("mt-0.5 text-[12px]", selected ? "text-paper/75" : "text-muted")}>{hint}</span>}
    </button>
  );
}

export function SimulatedNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11.5px] leading-snug text-muted", className)}>
      <span className="mr-1 font-semibold tracking-[0.12em] text-brass uppercase">Simulated</span>
      {children}
    </p>
  );
}

export function MilestoneTimeline({ milestones, compact = false }: { milestones: JourneyMilestone[]; compact?: boolean }) {
  return (
    <ol className="relative space-y-0" data-testid="milestone-timeline" aria-label="Order progress">
      {milestones.map((m, i) => {
        const last = i === milestones.length - 1;
        return (
          <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0" data-status={m.status} data-testid="milestone">
            {!last && (
              <span
                aria-hidden
                className={cn("absolute top-6 left-[11px] h-[calc(100%-18px)] w-px", m.status === "done" ? "bg-navy" : "bg-hairline")}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-500",
                m.status === "done" && "border-navy bg-navy text-paper",
                m.status === "current" && "border-brass bg-brass-wash text-brass",
                m.status === "upcoming" && "border-hairline bg-raised text-faint",
              )}
            >
              {m.status === "done" ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "text-[14px] leading-snug",
                  m.status === "current" ? "font-medium text-ink" : m.status === "done" ? "text-ink-soft" : "text-muted",
                )}
              >
                {m.label}
                {m.status === "current" && <span className="ml-2 text-[10.5px] tracking-[0.12em] text-brass uppercase">Now</span>}
              </div>
              {!compact && (m.status !== "upcoming" || i === 0) && (
                <div className="text-[12.5px] leading-snug text-muted">{m.description}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
