/* ─────────────────────────────────────────────────────────────────
   Sirrom Studios × Andrew Porter Fine Clothiers — pricing model.
   Typed port of ap-pricing.jsx from the Claude Design export.
   The math is unchanged; keep it that way unless pricing changes.
   ───────────────────────────────────────────────────────────────── */

export type ModuleId = "research" | "discovery" | "journey";
export type TierId = "low" | "medium" | "high";
export type Tier = TierId | "custom";

export interface ApModule {
  id: ModuleId;
  name: string;
  short: string;
  desc: string;
  unit: string;
  question: string;
  limits: [number, number, number];
  note?: string;
}

export const AP_MODULES: ApModule[] = [
  {
    id: "research",
    name: "Research Prospect",
    short: "Research",
    desc: "AI researches known prospects, organizes publicly available professional information, provides cited findings, and prepares personalized consultation insights.",
    unit: "research briefs",
    question: "How many people will Andrew research per month?",
    limits: [25, 75, 200],
  },
  {
    id: "discovery",
    name: "Discover Professionals",
    short: "Discovery",
    desc: "AI discovers professionals matching a chosen location and professional audience, presents verified public information, and offers research-based next steps.",
    unit: "discovery searches",
    question: "How many discovery searches will Andrew run per month?",
    limits: [5, 15, 40],
    note: "Each search targets up to 5 verified professional profiles.",
  },
  {
    id: "journey",
    name: "Client Journey",
    short: "Client Journey",
    desc: "A branded digital customer experience with interest forms, style preferences, consultation requests, a customer portal, order milestones, and AI-assisted preparation.",
    unit: "new inquiries",
    question: "How many new customer inquiries will Andrew receive per month?",
    limits: [25, 75, 200],
    note: "Includes one AI preparation brief per inquiry.",
  },
];

export const AP_TIERS: { id: TierId; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];
export const AP_TIER_LABEL: Record<Tier, string> = { low: "Low", medium: "Medium", high: "High", custom: "Custom" };

/** Editable numbers; '' while a field is being cleared. */
export type Num = number | "";
export type ModulePricing = { setup: Num; low: Num; medium: Num; high: Num };
export interface Pricing {
  research: ModulePricing;
  discovery: ModulePricing;
  journey: ModulePricing;
  disc2: Num;
  disc3Setup: Num;
  disc3Monthly: Num;
  partner: Num;
}

export const AP_DEFAULT_PRICING: Pricing = {
  research: { setup: 2000, low: 199, medium: 299, high: 499 },
  discovery: { setup: 2500, low: 299, medium: 449, high: 699 },
  journey: { setup: 5000, low: 399, medium: 599, high: 899 },
  disc2: 10,
  disc3Setup: 20,
  disc3Monthly: 15,
  partner: 2195,
};

export type Mode = "modular" | "partner";
export interface ModuleSel {
  on: boolean;
  usage: Num;
}
export interface Selection {
  mode: Mode;
  modules: Record<ModuleId, ModuleSel>;
}
export interface ApState {
  sel: Selection;
  pricing: Pricing;
}

export const AP_DEFAULT_SEL: Selection = {
  mode: "modular",
  modules: { research: { on: false, usage: 25 }, discovery: { on: false, usage: 5 }, journey: { on: false, usage: 25 } },
};

export const AP_KEY = "sirrom-apfc-pricing-v1";

export const apClone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const apNum = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : 0;
};
export const apPct = (v: unknown) => Math.min(100, apNum(v));
export const apCents = (x: number) => Math.round(x * 100) / 100;
export const apRound5 = (x: number) => Math.round(apCents(x) / 5) * 5;

export function apTier(usage: unknown, limits: [number, number, number]): Tier {
  const u = apNum(usage);
  if (u <= limits[0]) return "low";
  if (u <= limits[1]) return "medium";
  if (u <= limits[2]) return "high";
  return "custom";
}

export const apRange = (limits: number[], i: number) => (i === 0 ? `0–${limits[0]}` : `${limits[i - 1] + 1}–${limits[i]}`);

export function apFmt(n: number | null | undefined): string {
  if (n == null) return "—";
  const frac = Math.abs(n % 1) > 0.004;
  return (
    (n < 0 ? "−$" : "$") +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 })
  );
}

export interface ModularLine {
  id: ModuleId;
  mod: ApModule;
  usage: number;
  tier: Tier;
  setup: number;
  price: number | null;
}
export interface PartnerLine {
  id: ModuleId;
  mod: ApModule;
  usage: number;
  over: boolean;
}
export type Quote =
  | { mode: "partner"; empty: false; lines: PartnerLine[]; setup: 0; monthly: number; firstYear: number; overMedium: PartnerLine[] }
  | { mode: "modular"; empty: true; lines: ModularLine[]; n: 0 }
  | {
      mode: "modular";
      empty: false;
      lines: ModularLine[];
      n: number;
      setupPct: number;
      monthlyPct: number;
      hasCustom: boolean;
      setupOrig: number;
      monthlyOrig: number;
      setupNet: number;
      monthlyNet: number | null;
      setupDisc: number;
      monthlyDisc: number | null;
      firstYear: number | null;
      savings: number | null;
    };

export function apComputeQuote(sel: Selection, P: Pricing): Quote {
  if (sel.mode === "partner") {
    const monthly = apNum(P.partner);
    const lines = AP_MODULES.map((m) => {
      const u = apNum(sel.modules[m.id].usage);
      return { id: m.id, mod: m, usage: u, over: u > m.limits[1] };
    });
    return { mode: "partner", empty: false, lines, setup: 0, monthly, firstYear: apCents(monthly * 12), overMedium: lines.filter((l) => l.over) };
  }
  const lines: ModularLine[] = AP_MODULES.filter((m) => sel.modules[m.id].on).map((m) => {
    const u = apNum(sel.modules[m.id].usage);
    const tier = apTier(u, m.limits);
    const p = P[m.id];
    return { id: m.id, mod: m, usage: u, tier, setup: apNum(p.setup), price: tier === "custom" ? null : apNum(p[tier]) };
  });
  const n = lines.length;
  if (!n) return { mode: "modular", empty: true, lines, n: 0 };
  const setupPct = n === 2 ? apPct(P.disc2) : n === 3 ? apPct(P.disc3Setup) : 0;
  const monthlyPct = n === 2 ? apPct(P.disc2) : n === 3 ? apPct(P.disc3Monthly) : 0;
  const hasCustom = lines.some((l) => l.price == null);
  const setupOrig = apCents(lines.reduce((s, l) => s + l.setup, 0));
  const monthlyOrig = apCents(lines.reduce((s, l) => s + (l.price || 0), 0));
  const setupNet = setupPct ? apRound5(setupOrig * (1 - setupPct / 100)) : setupOrig;
  const monthlyNet = hasCustom ? null : monthlyPct ? apRound5(monthlyOrig * (1 - monthlyPct / 100)) : monthlyOrig;
  const firstYear = monthlyNet == null ? null : apCents(setupNet + 12 * monthlyNet);
  const savings = monthlyNet == null ? null : apCents(setupOrig - setupNet + 12 * (monthlyOrig - monthlyNet));
  return {
    mode: "modular",
    empty: false,
    lines,
    n,
    setupPct,
    monthlyPct,
    hasCustom,
    setupOrig,
    monthlyOrig,
    setupNet,
    monthlyNet,
    setupDisc: apCents(setupOrig - setupNet),
    monthlyDisc: monthlyNet == null ? null : apCents(monthlyOrig - monthlyNet),
    firstYear,
    savings,
  };
}

export function apQuoteText(q: Quote): string {
  const out = ["Sirrom Studios × Andrew Porter Fine Clothiers — Pricing Summary", ""];
  if (q.mode === "partner") {
    out.push("Sirrom AI Technology Partnership (12-month agreement)");
    out.push("Includes all three modules at Medium usage allowances:");
    q.lines.forEach((l) =>
      out.push(
        `• ${l.mod.name}: up to ${l.mod.limits[1]} ${l.mod.unit}/mo (expected ${l.usage})${l.over ? " — exceeds Medium, custom usage adjustment required" : ""}`,
      ),
    );
    out.push("", `Setup: $0`, `Monthly: ${apFmt(q.monthly)}`, `12-month contract value: ${apFmt(q.firstYear)}`);
    return out.join("\n");
  }
  if (q.empty) return out.concat("No modules selected yet.").join("\n");
  out.push("Selected modules:");
  q.lines.forEach((l) =>
    out.push(
      `• ${l.mod.name}: ${l.usage} ${l.mod.unit}/mo — ${l.tier === "custom" ? "Custom quote required" : `${AP_TIER_LABEL[l.tier]} tier, ${apFmt(l.price)}/mo`}`,
    ),
  );
  out.push("");
  if (q.setupPct || q.monthlyPct) out.push(`Bundle savings: ${q.setupPct}% off setup, ${q.monthlyPct}% off monthly`);
  out.push(`One-time setup: ${apFmt(q.setupNet)}`);
  out.push(`Monthly: ${q.monthlyNet == null ? "Custom quote required" : apFmt(q.monthlyNet)}`);
  out.push(`First-year total: ${q.firstYear == null ? "Custom quote required" : apFmt(q.firstYear)}`);
  return out.join("\n");
}

/** Merges a saved state (raw localStorage string) over the defaults; bad data falls back to defaults. */
export function apLoad(raw: string | null): ApState {
  const base: ApState = { sel: apClone(AP_DEFAULT_SEL), pricing: apClone(AP_DEFAULT_PRICING) };
  try {
    const r = raw ? JSON.parse(raw) : null;
    if (!r || !r.sel || !r.pricing) return base;
    const pricing: Pricing = { ...base.pricing, ...r.pricing };
    const modules = {} as Record<ModuleId, ModuleSel>;
    AP_MODULES.forEach((m) => {
      pricing[m.id] = { ...base.pricing[m.id], ...(r.pricing[m.id] || {}) };
      modules[m.id] = { ...base.sel.modules[m.id], ...((r.sel.modules || {})[m.id] || {}) };
    });
    return { sel: { mode: r.sel.mode === "partner" ? "partner" : "modular", modules }, pricing };
  } catch {
    return base;
  }
}
