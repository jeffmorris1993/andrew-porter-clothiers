import { describe, expect, it } from "vitest";
import { demoAssist, demoBrief, demoDiscover, demoIdentify } from "@/lib/demo/engine";
import { DEMO_SCENARIOS } from "@/lib/demo/fixtures";
import { ProspectBriefSchema } from "@/lib/schemas";

describe("demo engine", () => {
  it("has three labeled scenarios that produce valid sample briefs", () => {
    expect(DEMO_SCENARIOS).toHaveLength(3);
    for (const s of DEMO_SCENARIOS) {
      const id = demoIdentify(s.input);
      expect(id.mode).toBe("demo");
      for (const c of id.candidates) {
        const b = demoBrief(s.input, c, "single-match");
        expect(ProspectBriefSchema.safeParse(b).success).toBe(true);
        expect(b.mode).toBe("demo");
        expect(b.sources.every((src) => src.sample && new URL(src.url).hostname.endsWith(".example"))).toBe(true);
        const ids = new Set(b.sources.map((x) => x.id));
        for (const f of b.findings) for (const sid of f.sourceIds) expect(ids.has(sid)).toBe(true);
      }
    }
  });

  it("gives ambiguous candidates distinct source ids", () => {
    const r = demoIdentify(DEMO_SCENARIOS[1].input);
    expect(r.status).toBe("ambiguous");
    const [a, b] = r.candidates;
    expect(a.sourceIds.some((id) => b.sourceIds.includes(id))).toBe(false);
    expect(new Set(r.sources.map((s) => s.id)).size).toBe(r.sources.length);
  });

  it("does not invent people outside the sample set", () => {
    expect(demoIdentify({ fullName: "Real Person" }).status).toBe("not-found");
  });

  it("never pads the discovery shortlist", () => {
    expect(demoDiscover({ region: "Indy", roles: ["CEO"], resultLimit: 10 }).results).toHaveLength(4);
  });

  it("labels assistant answers as sample responses", () => {
    const b = demoBrief(DEMO_SCENARIOS[0].input, demoIdentify(DEMO_SCENARIOS[0].input).candidates[0], "single-match");
    const r = demoAssist("Are these details verified?", { briefs: [b], discoveries: [] });
    expect(r.answer).toMatch(/^Sample response/);
    expect(r.referencedFindingIds.length).toBeGreaterThan(0);
  });
});
