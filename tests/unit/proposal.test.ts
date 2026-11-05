import { describe, expect, it } from "vitest";
import {
  AP_DEFAULT_PRICING,
  AP_DEFAULT_SEL,
  AP_MODULES,
  apClone,
  apComputeQuote,
  apFmt,
  apLoad,
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
