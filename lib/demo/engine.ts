import { contextText, mergeFollowup } from "@/lib/research/context";
import type {
  AssistContext,
  AssistResponse,
  DiscoveryRequest,
  DiscoveryResponse,
  FollowupResult,
  IdentifyResult,
  IdentityCandidate,
  ProspectBrief,
  ProspectInput,
} from "@/lib/schemas";
import { PEOPLE, buildDemoBrief, candidateFor, demoDiscoveryResults, demoKeyForCandidate, demoPersonForName } from "./fixtures";

/* Demo Mode engine: deterministic responses built from fictional fixtures.
   It is labeled as sample output everywhere and never calls a model. */

export { mergeFollowup };

export function demoIdentify(input: ProspectInput): IdentifyResult {
  const keys = demoPersonForName(input.fullName);
  if (!keys) {
    return {
      status: "not-found",
      candidates: [],
      sources: [],
      note: "Demo Mode only contains fictional sample prospects (Marcus Ellery, James Whitfield, Ryan Teller, Helen Marsh, Victor Lindqvist). Switch to Live Mode to research a real professional.",
      mode: "demo",
    };
  }
  // Each fixture numbers its own sources S1…; renumber so candidates never share an id.
  let offset = 0;
  const candidates: IdentityCandidate[] = [];
  const sources: IdentifyResult["sources"] = [];
  for (const k of keys) {
    const own = buildDemoBrief(PEOPLE[k], input, "single-match").sources;
    const remap = (id: string) => `S${Number(id.slice(1)) + offset}`;
    const c = candidateFor(PEOPLE[k]);
    candidates.push({ ...c, sourceIds: c.sourceIds.map(remap) });
    sources.push(...own.map((s) => ({ ...s, id: remap(s.id) })));
    offset += own.length;
  }
  return {
    status: candidates.length > 1 ? "ambiguous" : "single-match",
    candidates,
    sources,
    note: candidates.length > 1 ? "Sample scenario: two fictional people share this name." : undefined,
    mode: "demo",
  };
}


export function demoBrief(input: ProspectInput, candidate: IdentityCandidate, status: ProspectBrief["identityStatus"]): ProspectBrief {
  const key = demoKeyForCandidate(candidate.id);
  if (!key) throw new Error("Unknown sample candidate");
  return buildDemoBrief(PEOPLE[key], input, status);
}

export function demoFollowup(brief: ProspectBrief, aspect: string): FollowupResult {
  return {
    aspect,
    summary: "Sample data: Demo Mode cannot search the web, so no additional information was found.",
    findings: [],
    sources: [],
    missingInformation: [aspect],
    systemNotes: ["Demo Mode — additional research is only available in Live Mode."],
  };
}

export function demoDiscover(req: DiscoveryRequest): DiscoveryResponse {
  const results = demoDiscoveryResults().slice(0, req.resultLimit);
  return {
    request: req,
    results,
    note:
      req.resultLimit > results.length
        ? `Sample shortlist: ${results.length} fictional profiles. In Live Mode, fewer results than requested are shown when fewer can be supported by sources.`
        : undefined,
    systemNotes: ["Sample data: every person, company and source is fictional."],
    mode: "demo",
  };
}

/** Rule-based sample answers over the selected context. Clearly labeled; not AI. */
export function demoAssist(question: string, ctx: AssistContext): AssistResponse {
  const q = question.toLowerCase();
  const { findingIds } = contextText(ctx);
  const briefs = ctx.briefs;
  const label = "Sample response (Demo Mode uses simple rules over the sample research; Live Mode uses the AI).";
  if (!briefs.length && !ctx.discoveries.length) {
    return { answer: `${label}\n\nSelect a brief or profile first.`, answerableFromContext: false, referencedFindingIds: [], mode: "demo" };
  }
  const tag = (i: number) => (briefs.length > 1 ? `B${i + 1}-` : "");
  const lines: string[] = [];
  let refs: string[] = [];
  let answerable = true;
  let suggestedSearch: string | undefined;

  if (/miss|gap|unknown|don't know|not know/.test(q)) {
    briefs.forEach((b) => {
      lines.push(`${b.professionalProfile.name} — still unknown:`);
      lines.push(...b.missingInformation.map((m) => `- ${m}`));
    });
    ctx.discoveries.forEach((d) => {
      lines.push(`${d.person} — still unknown:`);
      lines.push(...d.researchGaps.map((m) => `- ${m}`));
    });
  } else if (/question|ask/.test(q)) {
    briefs.forEach((b) => {
      lines.push(`Questions for ${b.professionalProfile.name}:`);
      lines.push(...b.suggestedQuestions.map((m) => `- ${m}`));
    });
  } else if (/verif|source|true|accurate|confirm/.test(q)) {
    briefs.forEach((b, i) => {
      lines.push(`${b.professionalProfile.name}:`);
      for (const f of b.findings) {
        refs.push(`${tag(i)}${f.id}`);
        lines.push(`- [${tag(i)}${f.id}] ${f.verificationStatus}: ${f.claim}`);
      }
    });
    lines.push("Customer-provided details are what the prospect told you; they are not verified by research.");
  } else if (/compar|differ|versus|vs/.test(q) && briefs.length > 1) {
    briefs.forEach((b, i) => {
      const p = b.professionalProfile;
      const strong = b.findings.filter((f) => f.verificationStatus === "corroborated").length;
      lines.push(
        `- ${p.name}: ${p.role ?? "role unknown"}, ${p.organization ?? "organization unknown"} — ${b.findings.length} findings (${strong} corroborated), ${b.missingInformation.length} open gaps.`,
      );
      refs.push(...b.findings.slice(0, 1).map((f) => `${tag(i)}${f.id}`));
    });
  } else if (/else|know|tell me|summar/.test(q)) {
    briefs.forEach((b) => lines.push(b.professionalProfile.summary));
  } else {
    answerable = false;
    lines.push("The sample research does not contain an answer to that question.");
    suggestedSearch = question.slice(0, 120);
  }
  refs = refs.filter((r) => findingIds.has(r));
  return {
    answer: `${label}\n\n${lines.join("\n")}`,
    answerableFromContext: answerable,
    referencedFindingIds: refs,
    suggestedSearch,
    mode: "demo",
  };
}
