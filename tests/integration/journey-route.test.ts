import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/journey/brief/route";
import { OpenAIReasoningModel, OpenAIWebSearchProvider } from "@/lib/research/openai";
import { setPipelineDepsForTests } from "@/lib/server/handler";
import { fakeClient, structuredResponse } from "../fixtures/responses";

const cfg = { apiKey: "t", model: "gpt-5.4-mini", timeoutMs: 1000 };
const body = {
  firstName: "Graham",
  interests: ["Custom suit"],
  occasion: "New role",
  timeline: "In 1–3 months",
  budget: "$3,000 – $6,000",
  preferredContact: "email",
  consent: true,
};
const req = (b: unknown, ip: string) =>
  new Request("http://localhost/api/journey/brief", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(b) });

afterEach(() => setPipelineDepsForTests(null));

describe("POST /api/journey/brief", () => {
  it("requires consent", async () => {
    const res = await POST(req({ ...body, consent: false }, "5.0.0.1"));
    expect(res.status).toBe(400);
  });

  it("makes one structured call with no web search and returns a live brief", async () => {
    const c = fakeClient([
      structuredResponse({
        summary: "Graham wants a suit for a new role.",
        statedPreferences: ["Custom suit"],
        timingConstraints: ["1–3 months"],
        unansweredQuestions: ["First-wear date"],
        consultationQuestions: ["What will you wear first?"],
        suggestedActions: [{ title: "Confirm", why: "Asked", tradeoffs: [], decisionForAndrew: "Which time?" }],
        draftMessage: { subject: "Welcome", body: "Dear Graham" },
      }),
    ]);
    setPipelineDepsForTests({ evidence: new OpenAIWebSearchProvider(c, cfg), model: new OpenAIReasoningModel(c, cfg) });
    const res = await POST(req(body, "5.0.0.2"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("live");
    expect(json.usage.calls).toBe(1);
    expect(c.requests).toHaveLength(1);
    expect(c.requests[0].tools).toBeUndefined();
    expect(String(c.requests[0].input)).toContain("New role");
    expect(String(c.requests[0].input)).not.toContain("consent");
  });

  it("returns model failures as errors (no sample fallback)", async () => {
    const c = fakeClient([Object.assign(new Error("boom"), { status: 500 })]);
    setPipelineDepsForTests({ evidence: new OpenAIWebSearchProvider(c, cfg), model: new OpenAIReasoningModel(c, cfg) });
    const res = await POST(req(body, "5.0.0.3"));
    expect(res.status).toBe(502);
    expect((await res.json()).summary).toBeUndefined();
  });
});
