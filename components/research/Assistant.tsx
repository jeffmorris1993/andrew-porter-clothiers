"use client";

import { useRef, useState } from "react";
import { Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ClientError, clientFor } from "@/lib/client/api";
import type { ApiError, AssistContext, ChatMessage, FollowupResult } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { ErrorPanel, UsageLine } from "./bits";

interface Turn extends ChatMessage {
  refs?: string[];
  suggestedSearch?: string;
  answerable?: boolean;
  usage?: Parameters<typeof UsageLine>[0]["usage"];
  mode?: string;
}

const PROMPTS_ONE = [
  "What else should I know about this person?",
  "What questions should I ask before our meeting?",
  "What information is missing?",
  "Are these details actually verified?",
];
const PROMPTS_MANY = [
  "Compare these professional backgrounds.",
  "What information is missing for each?",
  "Which details are verified, and which are not?",
];

/** Renders "- " lines as a list and [F3] refs as subtle tags. */
function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s/.test(l) || !l.trim());
        const fmt = (l: string) =>
          l.split(/(\[[A-Z0-9-]+\])/g).map((part, j) =>
            /^\[[A-Z0-9-]+\]$/.test(part) ? (
              <span key={j} className="mx-0.5 rounded-[2px] bg-sunk px-1 text-[11px] text-navy">
                {part.slice(1, -1)}
              </span>
            ) : (
              <span key={j}>{part}</span>
            ),
          );
        return isList ? (
          <ul key={i} className="list-disc space-y-1 pl-4">
            {lines.filter((l) => l.trim()).map((l, j) => (
              <li key={j}>{fmt(l.replace(/^\s*[-•]\s/, ""))}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {fmt(l)}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function AssistantSheet({
  context,
  trigger,
  onFollowup,
}: {
  context: AssistContext;
  trigger: React.ReactNode;
  /** Present only when a single brief is in context: allows an additional web search. */
  onFollowup?: (f: FollowupResult) => void;
}) {
  const mode = useDesk((s) => s.mode);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [searching, setSearching] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const names = [...context.briefs.map((b) => b.professionalProfile.name), ...context.discoveries.map((d) => d.person)];
  const prompts = names.length > 1 ? PROMPTS_MANY : PROMPTS_ONE;
  const singleBrief = context.briefs.length === 1 && context.discoveries.length === 0 ? context.briefs[0] : null;

  const ask = async (question: string) => {
    if (question.trim().length < 2 || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setQ("");
    setBusy(true);
    setError(null);
    try {
      const r = await clientFor(mode).assist(question, context, history.slice(-10));
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: r.answer,
          refs: r.referencedFindingIds,
          suggestedSearch: r.suggestedSearch,
          answerable: r.answerableFromContext,
          usage: r.usage,
          mode: r.mode,
        },
      ]);
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Request failed", retryable: true });
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const runSearch = async (aspect: string) => {
    if (!singleBrief || !onFollowup) return;
    setSearching(true);
    setError(null);
    try {
      const f = await clientFor(singleBrief.mode).followup(singleBrief, aspect);
      onFollowup(f);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: `Additional research on “${aspect}”: ${f.summary}${
            f.findings.length ? `\n\n${f.findings.map((x) => `- [${x.id}] (${x.verificationStatus}) ${x.claim}`).join("\n")}` : ""
          }\n\nNew findings have been added to the brief.`,
          usage: f.usage,
          mode: singleBrief.mode,
        },
      ]);
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Search failed", retryable: true });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        title="Ask the AI"
        description={`Answers use only the research on ${names.join(", ") || "the selected profiles"}. ${
          mode === "demo" ? "Demo Mode gives rule-based sample answers." : "Facts are never invented."
        }`}
      >
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5" aria-live="polite">
          {turns.length === 0 && (
            <div className="space-y-2">
              <div className="eyebrow mb-2">Try asking</div>
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => ask(p)}
                  className="block w-full rounded-[3px] border border-hairline bg-raised px-3 py-2.5 text-left text-[13px] text-ink-soft transition-colors hover:border-brass hover:text-ink"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={cn("text-[13.5px] leading-relaxed", t.role === "user" ? "text-right" : "")}>
              {t.role === "user" ? (
                <div className="inline-block max-w-[85%] rounded-[3px] bg-navy px-3.5 py-2 text-left text-paper">{t.content}</div>
              ) : (
                <div className="rounded-[3px] border border-hairline bg-raised px-4 py-3 text-ink" data-testid="assistant-answer">
                  <AnswerText text={t.content} />
                  {t.answerable === false && t.suggestedSearch && (
                    <div className="mt-3 border-t border-hairline-soft pt-3">
                      <div className="eyebrow mb-1">Not in the current research</div>
                      {singleBrief && onFollowup && mode === "live" ? (
                        <Button size="sm" variant="outline" disabled={searching} onClick={() => runSearch(t.suggestedSearch!)}>
                          <Search /> {searching ? "Searching…" : `Search: “${t.suggestedSearch}”`}
                        </Button>
                      ) : (
                        <p className="text-[12px] text-muted">
                          Possible search: “{t.suggestedSearch}”.{" "}
                          {mode === "demo"
                            ? "Additional web research is available in Live Mode."
                            : "Open a single brief to run additional research."}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2">
                    <UsageLine usage={t.usage} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {(busy || searching) && (
            <div className="space-y-2" aria-label="Thinking">
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          )}
          {error && <ErrorPanel error={error} context="The assistant could not answer" />}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-end gap-2 border-t border-hairline px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <Textarea
            aria-label="Your question"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(q);
              }
            }}
            rows={2}
            maxLength={600}
            placeholder="Ask about this research…"
            className="min-h-[44px]"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={busy || q.trim().length < 2}>
            <Send />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
