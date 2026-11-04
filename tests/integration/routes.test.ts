import { afterEach, describe, expect, it } from "vitest";
import { POST as identifyPOST } from "@/app/api/research/identify/route";
import { POST as discoverPOST } from "@/app/api/discover/route";
import { POST as briefPOST } from "@/app/api/research/brief/route";
import { OpenAIReasoningModel, OpenAIWebSearchProvider } from "@/lib/research/openai";
import { setPipelineDepsForTests } from "@/lib/server/handler";
import { fakeClient, structuredResponse, webSearchResponse } from "../fixtures/responses";

const cfg = { apiKey: "t", model: "gpt-5.4-mini", timeoutMs: 1000 };
const req = (body: unknown, ip = "1.1.1.1") =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

function inject(queue: unknown[]) {
  const c = fakeClient(queue);
  setPipelineDepsForTests({ evidence: new OpenAIWebSearchProvider(c, cfg), model: new OpenAIReasoningModel(c, cfg) });
}
afterEach(() => setPipelineDepsForTests(null));

describe("API routes", () => {
  it("validates the request body", async () => {
    const res = await identifyPOST(req({ input: { fullName: "" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("invalid_request");
  });

  it("returns a live identity result with citation URLs", async () => {
    inject([
      webSearchResponse([[{ url: "https://acme.com/team", title: "Team", text: "Jane Smith is CEO of Acme." }]]),
      structuredResponse({ assessment: "single", note: null, candidates: [{ name: "Jane Smith", role: "CEO", organization: "Acme", region: null, distinguishingDetails: [], sourceIds: ["S1"] }] }),
    ]);
    const res = await identifyPOST(req({ input: { fullName: "Jane Smith" } }, "2.2.2.2"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("live");
    expect(json.sources[0].url).toBe("https://acme.com/team");
  });

  it("reports a missing API key as an error, not sample data", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const res = await identifyPOST(req({ input: { fullName: "Jane Smith" } }, "3.3.3.3"));
    if (saved) process.env.OPENAI_API_KEY = saved;
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe("not_configured");
    expect(json.candidates).toBeUndefined();
  });

  it("returns upstream failures as errors", async () => {
    inject([Object.assign(new Error("boom"), { status: 500 })]);
    const res = await discoverPOST(req({ request: { region: "Indianapolis", roles: ["CEO"], resultLimit: 5 } }, "4.4.4.4"));
    expect(res.status).toBe(502);
    expect((await res.json()).error.retryable).toBe(true);
  });

  it("rate limits research requests per client", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 13; i++) {
      inject([webSearchResponse([], [])]);
      last = await identifyPOST(req({ input: { fullName: "Jane Smith" } }, "9.9.9.9"));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toBeTruthy();
  });

  it("brief accepts a large identity source list and keeps only the chosen person's sources", async () => {
    inject([
      webSearchResponse([[{ url: "https://acme.com/team", title: "Team", text: "Jane Smith is CEO of Acme." }]]),
      structuredResponse({
        profile: { role: "CEO", organization: "Acme", location: null, summary: "Jane Smith is CEO of Acme." },
        findings: [{ ref: "F1", claim: "CEO of Acme.", category: "role", sourceIds: ["S1"], conflicting: false, uncertaintyNote: null }],
        missingInformation: [], preparationInsights: [], suggestedQuestions: [], actions: [],
      }),
    ]);
    const identitySources = Array.from({ length: 60 }, (_, i) => ({
      id: `S${i + 1}`, url: `https://site${i + 1}.example.org/page`, title: `Page ${i + 1}`, retrievedAt: "2026-11-04T00:00:00Z", cited: i < 2,
    }));
    const candidate = { id: "c1", name: "Jane Smith", role: "CEO", organization: "Acme", distinguishingDetails: [], sourceIds: ["S1", "S2"] };
    const res = await briefPOST(
      req({ input: { fullName: "Jane Smith" }, candidate, identityStatus: "single-match", identitySources, shareCustomerDetails: false }, "6.6.6.6"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const urls: string[] = json.sources.map((s: { url: string }) => s.url);
    expect(urls).toContain("https://site1.example.org/page");
    expect(urls).toContain("https://site2.example.org/page");
    expect(urls.filter((u) => /site\d+\.example\.org/.test(u) && !/site[12]\./.test(u))).toEqual([]);
  });
});
