"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, Radio } from "lucide-react";
import { useDesk } from "@/lib/store/store";
import { visibleSaved } from "@/lib/decisions";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/schemas";

const NAV = [
  { href: "/research", label: "Research Prospect", short: "Research" },
  { href: "/discover", label: "Discover Professionals", short: "Discover" },
  { href: "/desk", label: "Decision Desk", short: "Desk" },
  { href: "/journey", label: "Client Journey", short: "Journey" },
];

export interface ServerStatus {
  liveConfigured: boolean;
  model: string;
}

export function useServerStatus(): ServerStatus | null {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus({ liveConfigured: false, model: "" }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Data mode" className="flex rounded-full border border-hairline bg-raised p-[3px]">
      {(["demo", "live"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium tracking-[0.06em] uppercase transition-colors duration-200",
              active && m === "demo" && "bg-brass text-raised",
              active && m === "live" && "bg-navy text-paper",
              !active && "text-muted hover:text-ink",
            )}
          >
            {m === "demo" ? <FlaskConical className="size-3.5" /> : <Radio className="size-3.5" />}
            {m === "demo" ? "Demo" : "Live"}
          </button>
        );
      })}
    </div>
  );
}

function ModeBanner({ mode, status }: { mode: Mode; status: ServerStatus | null }) {
  if (mode === "demo") {
    return (
      <div data-testid="mode-banner" className="border-y border-brass/30 bg-brass-wash">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px] text-[#6d5530] sm:px-8">
          <span className="font-semibold tracking-[0.14em] uppercase">Demo Mode · Sample data</span>
          <span className="text-[#7d6640]">
            Every person, company and source shown is fictional. No web research or AI calls are made.
          </span>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="mode-banner" className="border-y border-navy bg-navy text-paper">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px] sm:px-8">
        <span className="flex items-center gap-2 font-semibold tracking-[0.14em] uppercase">
          <span className="pulse-dot inline-block size-1.5 rounded-full bg-brass-soft" aria-hidden />
          Live Mode · Real web research
        </span>
        <span className="text-paper/75">
          {status && !status.liveConfigured
            ? "The server has no OpenAI API key configured — live requests will fail until one is added."
            : `Uses OpenAI web search${status?.model ? ` (${status.model})` : ""}. Public professional sources only. Nothing is sent or saved to a CRM.`}
        </span>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = useDesk((s) => s.mode);
  const setMode = useDesk((s) => s.setMode);
  const seedDemo = useDesk((s) => s.seedDemo);
  const saved = useDesk((s) => s.saved);
  const status = useServerStatus();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for the persisted session to load before rendering workspaces.
    const done = () => {
      if (useDesk.getState().mode === "demo") seedDemo();
      setReady(true);
    };
    if (useDesk.persist.hasHydrated()) done();
    else return useDesk.persist.onFinishHydration(done);
  }, [seedDemo]);

  const deskCount = ready ? visibleSaved(saved, mode).length : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 pt-5 pb-4 sm:px-8">
          <Link href="/research" className="group flex items-baseline gap-3">
            <span className="font-display text-[25px] leading-none font-medium tracking-[0.01em] text-ink">
              Andrew Porter
            </span>
            <span className="hidden text-[10.5px] tracking-[0.22em] text-muted uppercase sm:inline">
              Client Intelligence Desk
            </span>
          </Link>
          <ModeSwitch mode={mode} onChange={setMode} />
        </div>
        <nav aria-label="Workspaces" className="border-t border-hairline-soft">
          <div className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-2 sm:gap-6 sm:px-8">
            {NAV.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 px-2 py-3 text-[13px] whitespace-nowrap transition-colors sm:px-0",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <span className="sm:hidden">{n.short}</span>
                  <span className="hidden sm:inline">{n.label}</span>
                  {n.href === "/desk" && deskCount > 0 && (
                    <span className="rounded-full bg-sunk px-1.5 text-[10.5px] text-ink-soft tabular-nums">{deskCount}</span>
                  )}
                  {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-brass" aria-hidden />}
                </Link>
              );
            })}
          </div>
        </nav>
        <ModeBanner mode={mode} status={status} />
      </header>
      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {ready ? (
          children
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Loading">
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-40 w-full" />
          </div>
        )}
      </main>
      <footer className="border-t border-hairline-soft">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-[11.5px] text-faint sm:px-8">
          <span>A concept demo by Sirrom Studios for Andrew Porter Fine Clothiers, Carmel, Indiana.</span>
          <span>Decision support only — Andrew makes every decision. Nothing is sent automatically.</span>
        </div>
      </footer>
    </div>
  );
}
