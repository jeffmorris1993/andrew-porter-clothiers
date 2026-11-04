import { describe, expect, it } from "vitest";
import { annotateEvidence } from "@/lib/research/pipeline";
import { SourceRegistry, assignStatus, isDisallowed, normalizeUrl, rootDomain, validSourceIds } from "@/lib/research/sources";

const T = "2026-11-04T00:00:00.000Z";

describe("source registry", () => {
  it("normalizes URLs and strips tracking parameters", () => {
    expect(normalizeUrl("https://www.acme.com/team/?utm_source=x&id=2#bio")).toBe("https://www.acme.com/team?id=2");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("dedupes by URL and assigns sequential ids", () => {
    const r = new SourceRegistry();
    expect(r.add({ url: "https://a.com/x?utm_medium=y", cited: false }, T)).toBe("S1");
    expect(r.add({ url: "https://a.com/x", title: "A page", cited: true }, T)).toBe("S1");
    expect(r.add({ url: "https://b.com/", cited: true }, T)).toBe("S2");
    expect(r.list()).toHaveLength(2);
    expect(r.get("S1")?.cited).toBe(true);
    expect(r.get("S1")?.title).toBe("A page");
  });

  it("excludes LinkedIn and people-search sites", () => {
    const r = new SourceRegistry();
    expect(isDisallowed("https://www.linkedin.com/in/someone")).toBe(true);
    expect(r.add({ url: "https://www.linkedin.com/in/someone", cited: true }, T)).toBeNull();
    expect(r.add({ url: "https://www.whitepages.com/name/x", cited: true }, T)).toBeNull();
    expect(r.list()).toHaveLength(0);
    expect(r.excluded).toEqual(["linkedin.com", "whitepages.com"]);
  });

  it("continues numbering after seeded sources", () => {
    const seeded = new SourceRegistry("S", [
      { id: "S4", url: "https://a.com/", title: "a", retrievedAt: T, cited: true },
    ]);
    expect(seeded.add({ url: "https://a.com/", cited: true }, T)).toBe("S4");
    expect(seeded.add({ url: "https://z.com/", cited: true }, T)).toBe("S5");
  });

  it("drops source ids the model invented", () => {
    const r = new SourceRegistry();
    r.add({ url: "https://a.com/", cited: true }, T);
    expect(validSourceIds(["S1", "S9", "S1", "https://fake.com"], r)).toEqual(["S1"]);
  });
});

describe("verification status", () => {
  const sources = [
    { id: "S1", url: "https://news.acme.com/a", title: "", retrievedAt: T, cited: true },
    { id: "S2", url: "https://www.acme.com/b", title: "", retrievedAt: T, cited: true },
    { id: "S3", url: "https://journal.example.org/c", title: "", retrievedAt: T, cited: true },
  ];
  it("is unverified with no sources", () => expect(assignStatus([], sources, false)).toBe("unverified"));
  it("treats subdomains of one site as a single source", () => {
    expect(rootDomain("https://news.acme.com/a")).toBe("acme.com");
    expect(assignStatus(["S1", "S2"], sources, false)).toBe("single-source");
  });
  it("is corroborated across independent domains", () => expect(assignStatus(["S1", "S3"], sources, false)).toBe("corroborated"));
  it("flags conflicts only when there is a source", () => {
    expect(assignStatus(["S1"], sources, true)).toBe("conflicting");
    expect(assignStatus([], sources, true)).toBe("unverified");
  });
});

describe("annotateEvidence", () => {
  it("replaces inline citation links with [S#] markers and registers consulted pages", () => {
    const text = "Jane is CEO of Acme ([acme.com](https://acme.com/team)). She joined in 2020 ([linkedin](https://linkedin.com/in/j)).";
    const a1 = text.indexOf(" ([acme");
    const e1 = text.indexOf(")).") + 2;
    const a2 = text.indexOf(" ([linkedin");
    const e2 = text.length - 1;
    const r = new SourceRegistry();
    const out = annotateEvidence(
      {
        text,
        citations: [
          { url: "https://acme.com/team", title: "Team", startIndex: a1, endIndex: e1 },
          { url: "https://linkedin.com/in/j", title: "LI", startIndex: a2, endIndex: e2 },
        ],
        consulted: [{ url: "https://other.org/page" }],
        usage: { model: "m", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, webSearchCalls: 1 },
      },
      r,
      T,
    );
    expect(out).toContain("Jane is CEO of Acme [S1]");
    expect(out).toContain("[excluded source]");
    expect(r.get("S2")?.url).toBe("https://other.org/page");
    expect(r.get("S2")?.cited).toBe(false);
  });
});
