import { describe, expect, it } from "vitest";
import { MAX_COMPARE, pruneCompare, recordDecision, setSavedStatus, toggleCompare, upsertSaved, visibleSaved } from "@/lib/decisions";
import { filterSensitive, sensitiveReason } from "@/lib/research/safety";
import { RateLimiter } from "@/lib/server/rate-limit";

describe("safety filter", () => {
  it.each([
    ["His estimated net worth is $40M.", "financial"],
    ["She earns a salary of $500,000.", "financial"],
    ["Lives at 1234 Maple Street in Carmel.", "contact"],
    ["Call him at (317) 555-0199.", "contact"],
    ["Email jane@acme.com for details.", "contact"],
    ["He is active in his religious community.", "protected"],
  ])("removes %s", (t, reason) => expect(sensitiveReason(t)).toBe(reason));

  it("keeps ordinary professional facts", () => {
    for (const t of [
      "Serves as managing partner of a law firm.",
      "The company is headquartered at Monument Circle.",
      "Joined the board of the Indianapolis Arts Council in 2022.",
      "Led the firm's expansion to 120 attorneys.",
    ])
      expect(sensitiveReason(t)).toBeNull();
  });

  it("counts what it removed", () => {
    const r = filterSensitive(["CEO of Acme", "net worth of $5M", "lives at 12 Oak Lane"], (x) => x);
    expect(r.kept).toEqual(["CEO of Acme"]);
    expect(r.removed).toEqual({ financial: 1, protected: 0, contact: 1 });
  });
});

describe("decision desk logic", () => {
  it("compares at most three profiles", () => {
    let ids: string[] = [];
    for (const id of ["a", "b", "c"]) ids = toggleCompare(ids, id).ids;
    expect(ids).toEqual(["a", "b", "c"]);
    const r = toggleCompare(ids, "d");
    expect(r.refused).toBe(true);
    expect(r.ids).toHaveLength(MAX_COMPARE);
    expect(toggleCompare(ids, "b").ids).toEqual(["a", "c"]);
  });

  it("saves once, dismisses, restores and prunes the comparison", () => {
    const t = "2026-01-01T00:00:00Z";
    let items = upsertSaved([], { kind: "brief", refId: "x", mode: "live" }, t);
    items = upsertSaved(items, { kind: "brief", refId: "x", mode: "live" }, t);
    expect(items).toHaveLength(1);
    items = setSavedStatus(items, "brief:x", "dismissed");
    expect(visibleSaved(items, "live")).toHaveLength(0);
    expect(visibleSaved(items, "live", "dismissed")).toHaveLength(1);
    expect(pruneCompare(["brief:x"], items)).toEqual([]);
    items = upsertSaved(items, { kind: "brief", refId: "x", mode: "live" }, t);
    expect(visibleSaved(items, "live")).toHaveLength(1);
  });

  it("keeps demo and live items apart", () => {
    const t = "2026-01-01T00:00:00Z";
    const items = upsertSaved(upsertSaved([], { kind: "brief", refId: "d", mode: "demo" }, t), { kind: "brief", refId: "l", mode: "live" }, t);
    expect(visibleSaved(items, "demo").map((i) => i.refId)).toEqual(["d"]);
    expect(visibleSaved(items, "live").map((i) => i.refId)).toEqual(["l"]);
  });

  it("records decisions newest first", () => {
    const a = recordDecision([], { mode: "demo", subjectName: "A", choice: "Invite" }, "t1");
    const b = recordDecision(a, { mode: "demo", subjectName: "A", choice: "Wait" }, "t2");
    expect(b.map((d) => d.choice)).toEqual(["Wait", "Invite"]);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    expect(rl.check("k").ok).toBe(true);
    expect(rl.check("k").ok).toBe(true);
    const blocked = rl.check("k");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rl.check("other").ok).toBe(true);
    now = 1001;
    expect(rl.check("k").ok).toBe(true);
  });
});
