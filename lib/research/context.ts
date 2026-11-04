import type { AssistContext, FollowupResult, ProspectBrief } from "@/lib/schemas";

/* Pure helpers shared by the server pipeline and the browser. */

export function uniq(items: string[], max = 12): string[] {
  const out: string[] = [];
  for (const i of items.map((x) => x.trim()).filter(Boolean)) if (!out.includes(i)) out.push(i);
  return out.slice(0, max);
}

export function contextText(ctx: AssistContext): { text: string; findingIds: Set<string> } {
  const ids = new Set<string>();
  const parts: string[] = [];
  ctx.briefs.forEach((b, bi) => {
    const tag = ctx.briefs.length > 1 ? `B${bi + 1}-` : "";
    const p = b.professionalProfile;
    const lines = [
      `## Prospect brief ${tag ? tag.slice(0, -1) : ""}: ${p.name} — ${p.role ?? "role unknown"}, ${p.organization ?? "organization unknown"}${p.location ? `, ${p.location}` : ""}`,
      `Identity status: ${b.identityStatus}`,
      `AI summary (interpretation): ${p.summary}`,
      "Findings:",
      ...b.findings.map((f) => {
        ids.add(`${tag}${f.id}`);
        const srcs = f.sourceIds
          .map((id) => b.sources.find((s) => s.id === id))
          .filter(Boolean)
          .map((s) => s!.publisher)
          .join(", ");
        return `- [${tag}${f.id}] (${f.verificationStatus}${srcs ? `; sources: ${srcs}` : ""}) ${f.claim}${f.uncertaintyNote ? ` — note: ${f.uncertaintyNote}` : ""}`;
      }),
      `Missing information: ${b.missingInformation.join("; ") || "none listed"}`,
      `Customer-provided (not verified): ${
        b.customerProvided.sharedWithAI
          ? [b.customerProvided.clothingInterest, b.customerProvided.statedBudget, b.customerProvided.notes]
              .filter(Boolean)
              .join(" | ") || "none"
          : "withheld from the AI by Andrew"
      }`,
      `Options under consideration: ${b.suggestedActions.map((a) => a.title).join("; ")}`,
    ];
    parts.push(lines.join("\n"));
  });
  ctx.discoveries.forEach((d, di) => {
    const tag = `P${di + 1}`;
    parts.push(
      [
        `## Discovery profile ${tag}: ${d.person} — ${d.professionalRole}, ${d.organization}${d.region ? `, ${d.region}` : ""} (not yet fully researched)`,
        `Identity confidence: ${d.identityConfidence.level} — ${d.identityConfidence.reason}`,
        `Why surfaced: ${d.relevanceExplanation}`,
        ...d.evidence.map((e, i) => {
          ids.add(`${tag}-E${i + 1}`);
          return `- [${tag}-E${i + 1}] (${e.verificationStatus}) ${e.claim}`;
        }),
        `Gaps: ${d.researchGaps.join("; ") || "none listed"}`,
      ].join("\n"),
    );
  });
  return { text: parts.join("\n\n") || "(no research context selected)", findingIds: ids };
}

/** Merges a follow-up into a brief, keeping ids stable. Pure — used by the client too. */
export function mergeFollowup(brief: ProspectBrief, f: FollowupResult): ProspectBrief {
  const sources = [...brief.sources, ...f.sources.filter((s) => !brief.sources.some((b) => b.id === s.id))];
  return {
    ...brief,
    findings: [...brief.findings, ...f.findings],
    sources,
    sourceIds: sources.map((s) => s.id),
    missingInformation: uniq([...brief.missingInformation, ...f.missingInformation], 14),
    systemNotes: uniq([...brief.systemNotes, `Additional research: “${f.aspect}” — ${f.summary}`, ...f.systemNotes], 20),
  };
}
