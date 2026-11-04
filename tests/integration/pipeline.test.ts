import { afterEach, describe, expect, it } from "vitest";
import { OpenAIReasoningModel, OpenAIWebSearchProvider, type OpenAIConfig } from "@/lib/research/openai";
import { buildBrief, discover, followup, identify, mergeFollowup, type PipelineDeps } from "@/lib/research/pipeline";
import { fakeClient, structuredResponse, webSearchResponse } from "../fixtures/responses";

const cfg: OpenAIConfig = { apiKey: "test", model: "gpt-5.4-mini", reasoningEffort: "low", timeoutMs: 1000 };
let n = 0;
function depsFor(queue: unknown[]) {
  const client = fakeClient(queue);
  const deps: PipelineDeps = {
    evidence: new OpenAIWebSearchProvider(client, cfg),
    model: new OpenAIReasoningModel(client, cfg),
    now: () => new Date("2026-11-04T12:00:00Z"),
    newId: () => `id${++n}`,
  };
  return { client, deps };
}
afterEach(() => {
  n = 0;
});

const ACME = "https://www.acmelogistics.com/leadership";
const IBJ = "https://www.ibj.com/articles/acme-names-cfo";
const MED = "https://www.meridian-health.org/doctors/jane-smith";

describe("identify", () => {
  it("returns a single match with real source references", async () => {
    const { deps, client } = depsFor([
      webSearchResponse([[{ url: ACME, title: "Leadership", text: "Jane Smith is CFO of Acme Logistics in Fishers, Indiana." }]]),
      structuredResponse({
        assessment: "single",
        note: null,
        candidates: [{ name: "Jane Smith", role: "CFO", organization: "Acme Logistics", region: "Fishers, IN", distinguishingDetails: ["Finance executive"], sourceIds: ["S1"] }],
      }),
    ]);
    const r = await identify({ fullName: "Jane Smith", region: "Indianapolis" }, deps);
    expect(r.status).toBe("single-match");
    expect(r.candidates[0].sourceIds).toEqual(["S1"]);
    expect(r.sources[0]).toMatchObject({ id: "S1", url: ACME, title: "Leadership", cited: true });
    expect(r.usage).toMatchObject({ calls: 2, webSearchCalls: 1, inputTokens: 3200, outputTokens: 1000 });
    // The first call used the web_search tool and asked for sources; the second used structured output, no tools.
    expect(client.requests[0].tools).toEqual([expect.objectContaining({ type: "web_search" })]);
    expect(client.requests[0].include).toEqual(["web_search_call.action.sources"]);
    expect(client.requests[1].tools).toBeUndefined();
    expect((client.requests[1].text as { format: { type: string } }).format.type).toBe("json_schema");
    // The synthesis input carries [S#] markers, not raw links.
    expect(String(client.requests[1].input)).toContain("[S1]");
  });

  it("keeps people with the same name separate and lets Andrew choose", async () => {
    const { deps } = depsFor([
      webSearchResponse([
        [{ url: ACME, title: "Leadership", text: "Jane Smith is CFO of Acme Logistics." }],
        [{ url: MED, title: "Dr. Jane Smith", text: "A different Jane Smith is a physician in Columbus, Ohio." }],
      ]),
      structuredResponse({
        assessment: "multiple",
        note: "Two different people.",
        candidates: [
          { name: "Jane Smith", role: "CFO", organization: "Acme Logistics", region: null, distinguishingDetails: [], sourceIds: ["S1"] },
          { name: "Jane Smith", role: "Physician", organization: "Meridian Health", region: "Columbus, OH", distinguishingDetails: [], sourceIds: ["S2"] },
        ],
      }),
    ]);
    const r = await identify({ fullName: "Jane Smith" }, deps);
    expect(r.status).toBe("ambiguous");
    expect(r.candidates.map((c) => c.organization)).toEqual(["Acme Logistics", "Meridian Health"]);
  });

  it("drops candidates with no real source and reports not-found", async () => {
    const { deps } = depsFor([
      webSearchResponse([[{ url: ACME, title: "Leadership", text: "No one by that name appears." }]]),
      structuredResponse({
        assessment: "single",
        note: null,
        candidates: [{ name: "Invented Person", role: "CEO", organization: "Nowhere", region: null, distinguishingDetails: [], sourceIds: ["S7"] }],
      }),
    ]);
    const r = await identify({ fullName: "Invented Person" }, deps);
    expect(r.status).toBe("not-found");
    expect(r.candidates).toEqual([]);
  });

  it("returns not-found without a second call when the search finds nothing", async () => {
    const { deps, client } = depsFor([webSearchResponse([], [])]);
    const r = await identify({ fullName: "Nobody Atall" }, deps);
    expect(r.status).toBe("not-found");
    expect(client.requests).toHaveLength(1);
  });
});

describe("buildBrief", () => {
  const candidate = { id: "c1", name: "Jane Smith", role: "CFO", organization: "Acme Logistics", region: "Fishers, IN", distinguishingDetails: [], sourceIds: ["S1"] };
  const identitySources = [{ id: "S1", url: ACME, title: "Leadership", retrievedAt: "x", cited: true }];

  function briefQueue(findings: unknown[], extra: Record<string, unknown> = {}) {
    return [
      webSearchResponse(
        [
          [{ url: ACME, title: "Leadership", text: "Jane Smith is CFO of Acme Logistics." }],
          [{ url: IBJ, title: "Acme names CFO", text: "She was named CFO in 2021." }],
          [{ url: "https://www.linkedin.com/in/janesmith", title: "LinkedIn", text: "Her profile lists an MBA." }],
        ],
        ["https://www.fishers-chamber.org/board"],
      ),
      structuredResponse({
        profile: { role: "Chief Financial Officer", organization: "Acme Logistics", location: null, summary: "Jane Smith is CFO of Acme Logistics." },
        findings,
        missingInformation: ["Style preferences"],
        preparationInsights: ["Her role involves investor meetings.", "She likely has a high net worth given her role."],
        suggestedQuestions: ["What will you wear the suits for?"],
        actions: [
          { title: "Invite", description: "Invite to consult", rationale: "Role confirmed", supportingFindingRefs: ["F1", "F9"], tradeoffs: ["fast"], uncertainties: [], missingInformation: [], decisionForAndrew: "Invite now?" },
          { title: "Wait", description: "Save for later", rationale: "No urgency", supportingFindingRefs: [], tradeoffs: [], uncertainties: [], missingInformation: [], decisionForAndrew: "Wait?" },
        ],
        ...extra,
      }),
    ];
  }

  it("links findings to real sources, sets status in code and excludes LinkedIn", async () => {
    const { deps, client } = depsFor(
      briefQueue([
        { ref: "F1", claim: "Serves as CFO of Acme Logistics.", category: "role", sourceIds: ["S1", "S2"], conflicting: false, uncertaintyNote: null },
        { ref: "F2", claim: "Named CFO in 2021.", category: "career", sourceIds: ["S2"], conflicting: false, uncertaintyNote: null },
        { ref: "F3", claim: "Holds an MBA.", category: "career", sourceIds: ["S99"], conflicting: false, uncertaintyNote: null },
        { ref: "F4", claim: "Has an estimated net worth of $10M.", category: "other", sourceIds: ["S1"], conflicting: false, uncertaintyNote: null },
      ]),
    );
    const b = await buildBrief(
      { input: { fullName: "Jane Smith", clothingInterest: "Suits", statedBudget: "$5k" }, candidate, identityStatus: "single-match", identitySources, shareCustomerDetails: false },
      deps,
    );
    const urls = b.sources.map((s) => s.url);
    expect(urls).toContain(ACME);
    expect(urls).toContain(IBJ);
    expect(urls.some((u) => u.includes("linkedin"))).toBe(false);
    expect(b.systemNotes.join(" ")).toMatch(/Excluded results from linkedin\.com/);

    const byClaim = Object.fromEntries(b.findings.map((f) => [f.claim, f]));
    expect(byClaim["Serves as CFO of Acme Logistics."].verificationStatus).toBe("corroborated");
    expect(byClaim["Named CFO in 2021."].verificationStatus).toBe("single-source");
    // Invented source id → stripped → unverified.
    expect(byClaim["Holds an MBA."].sourceIds).toEqual([]);
    expect(byClaim["Holds an MBA."].verificationStatus).toBe("unverified");
    // Financial speculation never reaches the brief.
    expect(b.findings.some((f) => /net worth/i.test(f.claim))).toBe(false);
    expect(b.preparationInsights.some((x) => /net worth/i.test(x))).toBe(false);
    expect(b.systemNotes.join(" ")).toMatch(/personal finances/);

    // Every finding source id exists in the brief's own source list.
    const ids = new Set(b.sources.map((s) => s.id));
    for (const f of b.findings) for (const id of f.sourceIds) expect(ids.has(id)).toBe(true);

    // Options: unknown refs dropped, all require approval, never more than 3.
    expect(b.suggestedActions[0].supportingFindingIds).toEqual(["F1"]);
    expect(b.suggestedActions.every((a) => a.requiresHumanApproval)).toBe(true);

    // Customer details were not shared, so they are not in the model input — but are kept on the brief.
    expect(String(client.requests[1].input)).not.toContain("$5k");
    expect(String(client.requests[1].input)).toContain("not shared with the AI");
    expect(b.customerProvided).toMatchObject({ statedBudget: "$5k", sharedWithAI: false });
    expect(b.mode).toBe("live");
  });

  it("includes customer details in the analysis only with consent, labeled as unverified", async () => {
    const { deps, client } = depsFor(briefQueue([]));
    await buildBrief(
      { input: { fullName: "Jane Smith", statedBudget: "$5k" }, candidate, identityStatus: "single-match", identitySources, shareCustomerDetails: true },
      deps,
    );
    const input = String(client.requests[1].input);
    expect(input).toContain("Self-reported budget: $5k");
    expect(input).toMatch(/Not verified/);
  });

  it("marks conflicting sources", async () => {
    const { deps } = depsFor(
      briefQueue([
        { ref: "F1", claim: "Joined Acme in 2019 or 2021.", category: "career", sourceIds: ["S1", "S2"], conflicting: true, uncertaintyNote: "Sources give different years." },
      ]),
    );
    const b = await buildBrief({ input: { fullName: "Jane Smith" }, candidate, identityStatus: "selected-by-user", identitySources, shareCustomerDetails: false }, deps);
    expect(b.findings[0]).toMatchObject({ verificationStatus: "conflicting", uncertaintyNote: "Sources give different years." });
    expect(b.identityStatus).toBe("selected-by-user");
  });
});

describe("followup", () => {
  it("adds new findings and sources with continuing ids", async () => {
    const { deps: d1 } = depsFor([
      webSearchResponse([[{ url: ACME, title: "Leadership", text: "Jane Smith is CFO." }]]),
      structuredResponse({
        profile: { role: "CFO", organization: "Acme", location: null, summary: "s" },
        findings: [{ ref: "F1", claim: "CFO of Acme.", category: "role", sourceIds: ["S1"], conflicting: false, uncertaintyNote: null }],
        missingInformation: [], preparationInsights: [], suggestedQuestions: [], actions: [],
      }),
    ]);
    const candidate = { id: "c1", name: "Jane Smith", distinguishingDetails: [], sourceIds: [] };
    const brief = await buildBrief({ input: { fullName: "Jane Smith" }, candidate, identityStatus: "single-match", identitySources: [], shareCustomerDetails: false }, d1);

    const { deps: d2 } = depsFor([
      webSearchResponse([[{ url: "https://www.indyarts.org/board", title: "Board", text: "She serves on the Indy Arts board." }]]),
      structuredResponse({ summary: "Found one board role.", findings: [{ ref: "N1", claim: "Serves on the Indy Arts board.", category: "affiliation", sourceIds: ["S2"], conflicting: false, uncertaintyNote: null }], missingInformation: [] }),
    ]);
    const f = await followup(brief, "board memberships", d2);
    expect(f.findings[0]).toMatchObject({ id: "F2", sourceIds: ["S2"], verificationStatus: "single-source" });
    expect(f.sources.map((s) => s.id)).toEqual(["S2"]);
    const merged = mergeFollowup(brief, f);
    expect(merged.findings.map((x) => x.id)).toEqual(["F1", "F2"]);
    expect(merged.sources.map((s) => s.id)).toEqual(["S1", "S2"]);
  });
});

describe("discover", () => {
  it("never pads the shortlist and drops unsupported people", async () => {
    const { deps } = depsFor([
      webSearchResponse([
        [{ url: ACME, title: "Leadership", text: "Jane Smith is CEO of Acme." }],
        [{ url: IBJ, title: "IBJ", text: "Acme's CEO Jane Smith spoke at the forum." }],
        [{ url: "https://www.beta.com/team", title: "Beta team", text: "Bob Lee is president of Beta." }],
      ]),
      structuredResponse({
        note: "Only a few could be supported.",
        people: [
          { name: "Jane Smith", role: "CEO", organization: "Acme", region: "Indianapolis", relevanceExplanation: "CEO in Indianapolis.", evidence: [{ claim: "CEO of Acme", sourceIds: ["S1", "S2"] }], researchGaps: [], identityConfidence: { level: "high", reason: "Official page and press agree." } },
          { name: "Bob Lee", role: "President", organization: "Beta", region: null, relevanceExplanation: "President of Beta.", evidence: [{ claim: "President of Beta", sourceIds: ["S3"] }], researchGaps: ["Region"], identityConfidence: { level: "high", reason: "Company page." } },
          { name: "Ghost Person", role: "CEO", organization: "Ghost Co", region: null, relevanceExplanation: "x", evidence: [{ claim: "CEO", sourceIds: ["S42"] }], researchGaps: [], identityConfidence: { level: "high", reason: "x" } },
          { name: "Jane Smith", role: "CEO", organization: "Acme", region: null, relevanceExplanation: "dup", evidence: [{ claim: "dup", sourceIds: ["S1"] }], researchGaps: [], identityConfidence: { level: "high", reason: "x" } },
        ],
      }),
    ]);
    const r = await discover({ region: "Indianapolis", roles: ["CEO", "President"], resultLimit: 5 }, deps);
    expect(r.results.map((p) => p.person)).toEqual(["Jane Smith", "Bob Lee"]);
    expect(r.systemNotes.join(" ")).toMatch(/1 candidate\(s\) were left out/);
    expect(r.results[0].identityConfidence.level).toBe("high");
    // Single-website evidence can't be "high" confidence.
    expect(r.results[1].identityConfidence.level).toBe("medium");
    expect(r.results[1].sources.map((s) => s.url)).toEqual(["https://www.beta.com/team"]);
  });

  it("caps results at the requested limit", async () => {
    const people = Array.from({ length: 7 }, (_, i) => ({
      name: `Person ${i}`, role: "CEO", organization: `Co ${i}`, region: null, relevanceExplanation: "r",
      evidence: [{ claim: "CEO", sourceIds: ["S1"] }], researchGaps: [], identityConfidence: { level: "medium", reason: "r" },
    }));
    const { deps } = depsFor([
      webSearchResponse([[{ url: ACME, title: "L", text: "Many CEOs." }]]),
      structuredResponse({ note: null, people }),
    ]);
    const r = await discover({ region: "Indianapolis", roles: ["CEO"], resultLimit: 5 }, deps);
    expect(r.results).toHaveLength(5);
  });
});

describe("failures", () => {
  it("maps upstream errors to typed research errors (no fallback data)", async () => {
    const err = Object.assign(new Error("Rate limit"), { status: 429 });
    const { deps } = depsFor([err]);
    await expect(identify({ fullName: "Jane Smith" }, deps)).rejects.toMatchObject({ code: "upstream_rate_limited", retryable: true });
  });

  it("rejects model output that does not match the schema", async () => {
    const { deps } = depsFor([
      webSearchResponse([[{ url: ACME, title: "L", text: "Jane Smith is CFO." }]]),
      structuredResponse({ candidates: "oops" }),
    ]);
    await expect(identify({ fullName: "Jane Smith" }, deps)).rejects.toMatchObject({ code: "invalid_model_output" });
  });
});
