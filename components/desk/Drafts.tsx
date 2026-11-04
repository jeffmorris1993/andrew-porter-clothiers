"use client";

import { useState } from "react";
import { Copy, FileText, Mail, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ClientError, clientFor } from "@/lib/client/api";
import { crmNote } from "@/lib/drafts";
import type { ApiError, ProspectBrief } from "@/lib/schemas";
import { useDesk, type DraftState } from "@/lib/store/store";
import { Card, ErrorPanel, UsageLine } from "@/components/research/bits";

const OBJECTIVES: { value: DraftState["objective"]; label: string }[] = [
  { value: "invite-consultation", label: "Invite to consult" },
  { value: "request-information", label: "Request more information" },
  { value: "follow-up", label: "Follow up" },
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked — text is still selectable */
        }
      }}
    >
      <Copy /> {done ? "Copied" : "Copy"}
    </Button>
  );
}

export function EmailDraft({ brief }: { brief: ProspectBrief }) {
  const draft = useDesk((s) => s.drafts[brief.id]);
  const setDraft = useDesk((s) => s.setDraft);
  const decisions = useDesk((s) => s.decisions);
  const [objective, setObjective] = useState<DraftState["objective"]>(draft?.objective ?? "invite-consultation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [usage, setUsage] = useState<Parameters<typeof UsageLine>[0]["usage"]>();
  const chosenAction = decisions.find((d) => d.briefId === brief.id)?.actionId;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await clientFor(brief.mode).draft(brief, objective, chosenAction);
      setUsage(r.usage);
      setDraft(brief.id, {
        subject: r.subject,
        body: r.body,
        reviewNotes: r.reviewNotes,
        basedOnFindingIds: r.basedOnFindingIds,
        objective,
        mode: r.mode,
        generatedAt: new Date().toISOString(),
        edited: false,
      });
    } catch (e) {
      setError(e instanceof ClientError ? e.info : { code: "client_error", message: "Draft failed", retryable: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5" data-testid="email-draft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-brass" />
          <h3 className="font-display text-[21px] text-ink">Email draft</h3>
        </div>
        <Badge tone="oxblood">Not sent · draft for your review</Badge>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`obj-${brief.id}`}>Purpose</Label>
          <select
            id={`obj-${brief.id}`}
            value={objective}
            onChange={(e) => setObjective(e.target.value as DraftState["objective"])}
            className="h-9 rounded-[3px] border border-hairline bg-raised px-2 text-[13px]"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" className="h-9" onClick={generate} disabled={busy}>
          {draft ? <RotateCcw /> : <FileText />} {busy ? "Writing…" : draft ? "Regenerate" : "Generate draft"}
        </Button>
      </div>
      {busy && <div className="skeleton mt-4 h-40" />}
      {error && (
        <div className="mt-4">
          <ErrorPanel error={error} onRetry={generate} context="The draft could not be written" />
        </div>
      )}
      {draft && !busy && (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor={`subj-${brief.id}`}>Subject</Label>
            <Input
              id={`subj-${brief.id}`}
              value={draft.subject}
              onChange={(e) => setDraft(brief.id, { ...draft, subject: e.target.value, edited: true })}
            />
          </div>
          <div>
            <Label htmlFor={`body-${brief.id}`}>Message</Label>
            <Textarea
              id={`body-${brief.id}`}
              value={draft.body}
              rows={12}
              onChange={(e) => setDraft(brief.id, { ...draft, body: e.target.value, edited: true })}
              className="font-[inherit] text-[13.5px]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] text-faint">
              {draft.edited ? "Edited by you" : draft.mode === "demo" ? "Sample template" : "AI draft — unedited"}
              {draft.basedOnFindingIds.length ? ` · draws on ${draft.basedOnFindingIds.join(", ")}` : ""}
            </span>
            <CopyButton text={`Subject: ${draft.subject}\n\n${draft.body}`} />
          </div>
          {draft.reviewNotes.length > 0 && (
            <div className="rounded-[3px] bg-sunk px-4 py-3">
              <div className="eyebrow mb-1">Check before using</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-soft">
                {draft.reviewNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <UsageLine usage={usage} />
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-faint">
        This app cannot send email. Copy the text into your own mail client if you decide to use it.
      </p>
    </Card>
  );
}

export function CrmNote({ brief }: { brief: ProspectBrief }) {
  const note = useDesk((s) => s.crmNotes[brief.id]);
  const setCrmNote = useDesk((s) => s.setCrmNote);
  const decision = useDesk((s) => s.decisions.find((d) => d.briefId === brief.id));
  return (
    <Card className="p-5" data-testid="crm-note">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-brass" />
          <h3 className="font-display text-[21px] text-ink">Insightly CRM note</h3>
        </div>
        <Badge tone="slate">Simulated · no CRM change</Badge>
      </div>
      <p className="mb-3 text-[12.5px] text-muted">
        Built directly from the brief (no AI), with source links and your recorded decision. Nothing is written to
        Insightly.
      </p>
      {note === undefined ? (
        <Button size="sm" variant="outline" onClick={() => setCrmNote(brief.id, crmNote(brief, decision))}>
          Generate simulated note
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            aria-label="Simulated CRM note"
            value={note}
            rows={14}
            onChange={(e) => setCrmNote(brief.id, e.target.value)}
            className="font-mono text-[12px] leading-relaxed"
          />
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setCrmNote(brief.id, crmNote(brief, decision))}>
              <RotateCcw /> Rebuild from brief
            </Button>
            <CopyButton text={note} />
          </div>
        </div>
      )}
    </Card>
  );
}
