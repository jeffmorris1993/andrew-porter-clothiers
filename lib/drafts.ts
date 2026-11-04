import type { DraftResponse, ProspectBrief, SuggestedAction } from "@/lib/schemas";

/* Drafts that do not need a model: the simulated Insightly CRM note (both
   modes) and the Demo Mode email template. Nothing here is ever sent. */

export interface DecisionLike {
  choice: string;
  note?: string;
  at: string;
}

export function crmNote(brief: ProspectBrief, decision?: DecisionLike): string {
  const p = brief.professionalProfile;
  const srcUrl = (id: string) => brief.sources.find((s) => s.id === id)?.url ?? "";
  const lines: string[] = [];
  lines.push(`SIMULATED INSIGHTLY NOTE — not synced; no CRM record was changed`);
  lines.push(brief.mode === "demo" ? `SAMPLE DATA — fictional person` : `Live research — review before saving to CRM`);
  lines.push("");
  lines.push(`Contact: ${p.name}`);
  if (p.role) lines.push(`Title: ${p.role}`);
  if (p.organization) lines.push(`Organization: ${p.organization}`);
  if (p.location) lines.push(`Location: ${p.location}`);
  lines.push(`Researched: ${new Date(brief.researchedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`);
  lines.push("");
  lines.push("Professional background (public sources):");
  const sourced = brief.findings.filter((f) => f.verificationStatus !== "unverified");
  if (!sourced.length) lines.push("- No source-backed findings.");
  for (const f of sourced) {
    lines.push(`- ${f.claim} [${f.verificationStatus}]`);
    for (const id of f.sourceIds) lines.push(`    ${srcUrl(id)}`);
  }
  const unverified = brief.findings.filter((f) => f.verificationStatus === "unverified");
  if (unverified.length) {
    lines.push("");
    lines.push("Unconfirmed (do not rely on):");
    for (const f of unverified) lines.push(`- ${f.claim}`);
  }
  const cp = brief.customerProvided;
  if (cp.clothingInterest || cp.statedBudget || cp.notes) {
    lines.push("");
    lines.push("Customer-provided (interest card):");
    if (cp.clothingInterest) lines.push(`- Interest: ${cp.clothingInterest}`);
    if (cp.statedBudget) lines.push(`- Stated budget: ${cp.statedBudget}`);
    if (cp.notes) lines.push(`- Notes: ${cp.notes}`);
  }
  if (brief.missingInformation.length) {
    lines.push("");
    lines.push("Open questions:");
    for (const m of brief.missingInformation) lines.push(`- ${m}`);
  }
  lines.push("");
  lines.push(
    decision
      ? `Andrew's decision: ${decision.choice}${decision.note ? ` — ${decision.note}` : ""} (${new Date(decision.at).toLocaleDateString("en-US", { dateStyle: "medium" })})`
      : "Andrew's decision: not yet recorded",
  );
  return lines.join("\n");
}

export function demoEmailDraft(
  brief: ProspectBrief,
  objective: "invite-consultation" | "request-information" | "follow-up",
  action?: SuggestedAction,
): DraftResponse {
  const first = brief.professionalProfile.name.split(" ")[0];
  const interest = brief.customerProvided.clothingInterest;
  const body =
    objective === "request-information"
      ? `Dear ${first},

Thank you for stopping by and for filling in an interest card${interest ? ` about ${interest.toLowerCase()}` : ""}. Before we set a time, it would help me to know a little more: roughly when you would need the first garment, and where you expect to wear it most.

There's no need for anything formal — a quick reply is perfect.

Warm regards,
Andrew Porter
Andrew Porter Fine Clothiers · Carmel, Indiana`
      : `Dear ${first},

Thank you for your interest in Andrew Porter Fine Clothiers${interest ? ` — I'd be glad to talk through ${interest.toLowerCase()}` : ""}. I would welcome the chance to meet for an unhurried consultation at the studio in Carmel.

Would [proposed day and time] suit you? If another time works better, just let me know.

Warm regards,
Andrew Porter
Andrew Porter Fine Clothiers · Carmel, Indiana`;
  return {
    subject:
      objective === "request-information"
        ? "A quick question before we meet"
        : "An invitation to the studio",
    body,
    basedOnFindingIds: [],
    reviewNotes: [
      "Sample template in Demo Mode — Live Mode writes the draft with the AI from the research.",
      "Fill in the bracketed details before using.",
      action ? `Drafted for the option “${action.title}”.` : "Confirm the tone fits how you met.",
    ],
    mode: "demo",
  };
}
