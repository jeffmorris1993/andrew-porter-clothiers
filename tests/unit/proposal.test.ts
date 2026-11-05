import { describe, expect, it } from "vitest";
import {
  AP_DEFAULT_PRICING,
  AP_DEFAULT_SEL,
  AP_MODULES,
  AP_PILOT_INFO,
  apClone,
  apComputeQuote,
  apFmt,
  apLoad,
  apPilotConversion,
  apQuoteText,
  apRange,
  apTier,
  type Selection,
} from "@/lib/proposal/pricing";

const P = AP_DEFAULT_PRICING;
function sel(on: Partial<Record<"research" | "discovery" | "journey", number>>, mode: Selection["mode"] = "modular"): Selection {
  const s = apClone(AP_DEFAULT_SEL);
  s.mode = mode;
  for (const [k, u] of Object.entries(on)) s.modules[k as "research"] = { on: true, usage: u! };
  return s;
}

describe("tiers", () => {
  it.each([
    [0, "low"], [25, "low"], [26, "medium"], [75, "medium"], [76, "high"], [200, "high"], [201, "custom"],
  ])("research usage %i → %s", (u, t) => expect(apTier(u, AP_MODULES[0].limits)).toBe(t));
  it("discovery has its own limits", () => {
    expect(apTier(5, AP_MODULES[1].limits)).toBe("low");
    expect(apTier(16, AP_MODULES[1].limits)).toBe("high");
    expect(apTier(41, AP_MODULES[1].limits)).toBe("custom");
  });
  it("treats blank or negative usage as zero", () => {
    expect(apTier("", AP_MODULES[0].limits)).toBe("low");
    expect(apTier(-5, AP_MODULES[0].limits)).toBe("low");
  });
  it("labels ranges", () => {
    expect(apRange([25, 75, 200], 0)).toBe("0–25");
    expect(apRange([25, 75, 200], 2)).toBe("76–200");
  });
});

describe("modular quotes", () => {
  it("is empty with nothing selected", () => expect(apComputeQuote(sel({}), P)).toMatchObject({ mode: "modular", empty: true }));

  it("one module has no discount", () => {
    const q = apComputeQuote(sel({ research: 50 }), P);
    expect(q).toMatchObject({ n: 1, setupPct: 0, monthlyPct: 0, setupNet: 2000, monthlyNet: 299, firstYear: 2000 + 12 * 299 });
  });

  it("two modules: 10% off setup and monthly, rounded to $5", () => {
    const q = apComputeQuote(sel({ research: 25, discovery: 5 }), P);
    expect(q).toMatchObject({ n: 2, setupOrig: 4500, setupNet: 4050, monthlyOrig: 498, monthlyNet: 450, firstYear: 9450 });
    if (q.mode === "modular" && !q.empty) expect(q.savings).toBe(450 + 12 * 48);
  });

  it("three modules: 20% off setup, 15% off monthly", () => {
    const q = apComputeQuote(sel({ research: 25, discovery: 5, journey: 25 }), P);
    expect(q).toMatchObject({ n: 3, setupOrig: 9500, setupNet: 7600, monthlyOrig: 897, monthlyNet: 760, firstYear: 16720 });
  });

  it("usage above High needs a custom quote", () => {
    const q = apComputeQuote(sel({ research: 250, discovery: 5 }), P);
    expect(q).toMatchObject({ hasCustom: true, monthlyNet: null, firstYear: null, savings: null, setupNet: 4050 });
  });

  it("uses edited pricing", () => {
    const custom = { ...apClone(P), disc2: 0, research: { setup: 1000, low: 100, medium: 200, high: 300 } };
    const q = apComputeQuote(sel({ research: 10, discovery: 5 }), custom);
    expect(q).toMatchObject({ setupNet: 3500, monthlyNet: 399 });
  });
});

describe("partnership", () => {
  it("is $0 setup and 12 × the retainer", () => {
    const q = apComputeQuote(sel({}, "partner"), P);
    expect(q).toMatchObject({ mode: "partner", setup: 0, monthly: 2195, firstYear: 26340 });
  });
  it("flags usage above the Medium allowance", () => {
    const s = sel({}, "partner");
    s.modules.discovery.usage = 20;
    const q = apComputeQuote(s, P);
    if (q.mode !== "partner") throw new Error("expected partner");
    expect(q.overMedium.map((l) => l.id)).toEqual(["discovery"]);
    expect(apQuoteText(q)).toContain("exceeds Medium, custom usage adjustment required");
  });
});

describe("formatting and quote text", () => {
  it("formats money", () => {
    expect(apFmt(9450)).toBe("$9,450");
    expect(apFmt(-48)).toBe("−$48");
    expect(apFmt(762.45)).toBe("$762.45");
    expect(apFmt(null)).toBe("—");
  });
  it("writes a plain-text summary", () => {
    const t = apQuoteText(apComputeQuote(sel({ research: 25, discovery: 5 }), P));
    expect(t).toContain("Bundle savings: 10% off setup, 10% off monthly");
    expect(t).toContain("One-time setup: $4,050");
    expect(t).toContain("First-year total: $9,450");
  });
});

describe("saved state", () => {
  it("falls back to defaults for missing or corrupt data", () => {
    expect(apLoad(null)).toEqual({ sel: AP_DEFAULT_SEL, pricing: AP_DEFAULT_PRICING });
    expect(apLoad("{not json")).toEqual({ sel: AP_DEFAULT_SEL, pricing: AP_DEFAULT_PRICING });
  });
  it("merges a partial save over the defaults", () => {
    const s = apLoad(JSON.stringify({ sel: { mode: "partner", modules: { research: { on: true } } }, pricing: { partner: 1999, research: { setup: 1500 } } }));
    expect(s.sel.mode).toBe("partner");
    expect(s.sel.modules.research).toEqual({ on: true, usage: 25 });
    expect(s.pricing.partner).toBe(1999);
    expect(s.pricing.research).toEqual({ setup: 1500, low: 199, medium: 299, high: 499 });
    expect(s.pricing.journey).toEqual(AP_DEFAULT_PRICING.journey);
  });
  it("ignores an unknown mode", () => {
    expect(apLoad(JSON.stringify({ sel: { mode: "weird", modules: {} }, pricing: {} })).sel.mode).toBe("modular");
  });
});

/* ── Starter Pilot ─────────────────────────────────────────────── */


function pilotSel(id: "research" | "discovery" | "journey", extra: Partial<Selection> = {}): Selection {
  return { ...apClone(AP_DEFAULT_SEL), mode: "pilot", pilot: id, ...extra };
}

describe("starter pilot", () => {
  it.each([
    ["research", 750, 30, 15, 500],
    ["discovery", 750, 30, 3, 500],
    ["journey", 3500, 45, 20, 2000],
  ] as const)("%s pilot defaults", (id, fee, days, usage, credit) => {
    const q = apComputeQuote(pilotSel(id), P);
    expect(q).toMatchObject({ mode: "pilot", id, fee, days, usage, credit, creditDays: 30 });
    if (q.mode === "pilot") {
      expect(q.lines).toEqual([]);
      expect(q.info).toBe(AP_PILOT_INFO[id]);
    }
  });

  it("journey pilot is a starting price with invited-customer limit and security prerequisites", () => {
    const q = apComputeQuote(pilotSel("journey"), P);
    if (q.mode !== "pilot") throw new Error("pilot expected");
    expect(q.customers).toBe(5);
    expect(q.info.startingAt).toBe(true);
    expect(q.info.prerequisites?.join(" ")).toMatch(/production database[\s\S]*authorization[\s\S]*isolation[\s\S]*Privacy notice[\s\S]*Access controls[\s\S]*retention and deletion/);
    expect(q.info.limitations).toEqual(expect.arrayContaining(["No real payments", "No Insightly integration"]));
  });

  it.each([
    ["research", 2000, 500, 1500, 199],
    ["discovery", 2500, 500, 2000, 299],
    ["journey", 5000, 2000, 3000, 399],
  ] as const)("%s conversion matches the worked example", (id, setup, credit, remaining, monthly) => {
    const c = apPilotConversion(pilotSel(id), P);
    expect(c).toMatchObject({ setupOrig: setup, setupNet: setup, creditApplied: credit, remainingSetup: remaining, monthly });
  });

  it("monthly follows the expected usage tier, and custom usage needs a quote", () => {
    const s = pilotSel("research");
    s.modules.research.usage = 60;
    expect(apPilotConversion(s, P).monthly).toBe(299);
    s.modules.research.usage = 500;
    expect(apPilotConversion(s, P)).toMatchObject({ monthly: null, hasCustom: true, remainingSetup: 1500 });
  });

  it("with a later bundle the credit is applied once, after the bundle discount", () => {
    const c = apPilotConversion(pilotSel("journey", { convertWith: ["research"] }), P);
    // (5000 + 2000) × 0.9 = 6300, minus the single $2,000 journey credit
    expect(c).toMatchObject({ modules: ["journey", "research"], setupOrig: 7000, setupPct: 10, setupNet: 6300, creditApplied: 2000, remainingSetup: 4300 });
    // monthly (399 + 199) × 0.9 = 538.2 → 540
    expect(c.monthly).toBe(540);
  });

  it("ignores the piloted module in convertWith and never double counts", () => {
    const c = apPilotConversion(pilotSel("research", { convertWith: ["research"] }), P);
    expect(c.modules).toEqual(["research"]);
    expect(c.creditApplied).toBe(500);
  });

  it("a credit larger than the setup never makes the balance negative", () => {
    const big = apClone(P);
    big.pilots.research.credit = 9999;
    const c = apPilotConversion(pilotSel("research"), big);
    expect(c).toMatchObject({ creditAvailable: 9999, creditApplied: 2000, remainingSetup: 0 });
  });

  it("edited pilot settings flow through", () => {
    const edited = apClone(P);
    edited.pilots.discovery = { price: 900, days: 21, usage: 4, credit: 600 };
    const q = apComputeQuote(pilotSel("discovery"), edited);
    expect(q).toMatchObject({ fee: 900, days: 21, usage: 4, credit: 600 });
    if (q.mode === "pilot") expect(q.conversion.remainingSetup).toBe(1900);
  });

  it("modular and partnership results are unchanged by pilot settings", () => {
    const edited = apClone(P);
    edited.pilots.research.price = 1;
    expect(apComputeQuote(sel({ research: 25, discovery: 5 }), edited)).toMatchObject({ firstYear: 9450 });
    expect(apComputeQuote(sel({}, "partner"), edited)).toMatchObject({ firstYear: 26340 });
  });

  it("quote text shows the pilot apart from the optional future implementation", () => {
    const t = apQuoteText(apComputeQuote(pilotSel("journey"), P));
    expect(t).toContain("One-time pilot fee: starting at $3,500 (subject to final technical scope and security requirements)");
    expect(t).toContain("No automatic monthly subscription.");
    expect(t).toContain("Optional future implementation (not due now):");
    expect(t).toContain("Remaining setup: $3,000");
  });

  it("loads old saved state without pilot settings, and keeps pilot selections", () => {
    const old = apLoad(JSON.stringify({ sel: { mode: "modular", modules: {} }, pricing: { partner: 2000 } }));
    expect(old.pricing.pilots).toEqual(AP_DEFAULT_PRICING.pilots);
    expect(old.sel).toMatchObject({ pilot: "research", convertWith: [] });
    const saved = apLoad(JSON.stringify({ sel: { mode: "pilot", pilot: "journey", convertWith: ["discovery", "bogus"], modules: {} }, pricing: { pilots: { journey: { price: 4000 } } } }));
    expect(saved.sel).toMatchObject({ mode: "pilot", pilot: "journey", convertWith: ["discovery"] });
    expect(saved.pricing.pilots.journey).toEqual({ price: 4000, days: 45, usage: 20, customers: 5, credit: 2000 });
  });
});
