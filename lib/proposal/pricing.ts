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
  /** Starter Pilot settings (editable on Page 2). */
  pilots: Record<ModuleId, PilotPricing>;
  /** Days after pilot completion during which the credit can be used. */
  pilotCreditDays: Num;
}

export interface PilotPricing {
  price: Num;
  days: Num;
  usage: Num;
  credit: Num;
  /** Client Journey only: maximum invited real customers. */
  customers?: Num;
}

export const AP_DEFAULT_PRICING: Pricing = {
  research: { setup: 2000, low: 199, medium: 299, high: 499 },
  discovery: { setup: 2500, low: 299, medium: 449, high: 699 },
  journey: { setup: 5000, low: 399, medium: 599, high: 899 },
  disc2: 10,
  disc3Setup: 20,
  disc3Monthly: 15,
  pilots: {
    research: { price: 750, days: 30, usage: 15, credit: 500 },
    discovery: { price: 750, days: 30, usage: 3, credit: 500 },
    journey: { price: 3500, days: 45, usage: 20, customers: 5, credit: 2500 },
  },
  pilotCreditDays: 30,
};

/* ── Starter Pilot — what each pilot includes and excludes ─────── */

export interface PilotInfo {
  id: ModuleId;
  name: string;
  usageUnit: string;
  /** The fee is a starting price, subject to final technical scope and security requirements. */
  startingAt: boolean;
  /** How the duration is counted. */
  durationNote: string;
  included: string[];
  limitations: string[];
  /** Conditions that must be met before the pilot can run (Client Journey). */
  prerequisites?: string[];
}

export const AP_PILOT_INFO: Record<ModuleId, PilotInfo> = {
  research: {
    id: "research",
    name: "Research Prospect Pilot",
    usageUnit: "AI prospect research briefs",
    startingAt: false,
    durationNote: "",
    included: ["Basic configuration and onboarding", "One results review"],
    limitations: [
      "No CRM integrations",
      "No production platform implementation",
      "No premium commercial data subscriptions",
    ],
  },
  discovery: {
    id: "discovery",
    name: "Discover Professionals Pilot",
    usageUnit: "discovery searches",
    startingAt: false,
    durationNote: "",
    included: ["Each search targets up to 5 verified professional profiles", "Basic configuration and onboarding", "One results review"],
    limitations: [
      "No automated outreach",
      "No contact database subscription",
      "No premium commercial data subscriptions",
    ],
  },
  journey: {
    id: "journey",
    name: "Client Journey Live Pilot",
    usageUnit: "AI preparation briefs",
    startingAt: true,
    durationNote: "of live access, starting once the portal is configured, tested and launched",
    included: [
      "One Andrew-side administrator",
      "Secure customer login and private client access",
      "Digital interest cards",
      "Style preference questionnaire",
      "Consultation requests, subject to Andrew's approval",
      "Customer-facing journey status",
      "Manual milestone management by Andrew",
      "AI-generated preparation summaries",
      "Initial configuration and onboarding",
      "Pilot results review",
    ],
    limitations: [
      "No real payments",
      "No automated emails or SMS marketing",
      "No Insightly integration",
      "No manufacturing integration",
      "No complex scheduling",
    ],
    prerequisites: [
      "Secure production database",
      "Authentication and authorization for Andrew and invited customers",
      "Customer data isolation",
      "Privacy notice for participating customers",
      "Access controls",
      "Agreed data retention and deletion process",
    ],
  },
};

/** Terms that apply to every Starter Pilot. */
export const AP_PILOT_RULES = [
  "The pilot does not become a subscription. A full implementation needs a separate agreement approved by Andrew.",
  "No recurring fees during the pilot evaluation.",
  "Temporary access ends when the pilot expires unless a separate agreement is signed.",
  "A pilot is not the same as a fully implemented module.",
  "Major feature development and integrations are quoted separately.",
];

export type Mode = "modular" | "pilot";
export interface ModuleSel {
  on: boolean;
  usage: Num;
}
export interface Selection {
  mode: Mode;
  modules: Record<ModuleId, ModuleSel>;
  /** Starter Pilot: the one module being piloted. */
  pilot: ModuleId;
  /** Conversion calculator: other modules Andrew might add when continuing. */
  convertWith: ModuleId[];
}
export interface ApState {
  sel: Selection;
  pricing: Pricing;
}

export const AP_DEFAULT_SEL: Selection = {
  mode: "modular",
  modules: { research: { on: false, usage: 25 }, discovery: { on: false, usage: 5 }, journey: { on: false, usage: 25 } },
  pilot: "research",
  convertWith: [],
};

/* v2: partnership removed and Client Journey pilot credit changed — older saved settings are not reused. */
export const AP_KEY = "sirrom-apfc-pricing-v2";

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
/** What continuing after a pilot would cost — optional, future, never added to the pilot fee. */
export interface PilotConversion {
  pilotId: ModuleId;
  /** Modules in the future implementation (the piloted one first). */
  modules: ModuleId[];
  lines: ModularLine[];
  /** Standard setup before any bundle discount. */
  setupOrig: number;
  setupPct: number;
  /** Setup after any bundle discount, before the pilot credit. */
  setupNet: number;
  creditAvailable: number;
  /** Credit applied once, never more than the setup balance. */
  creditApplied: number;
  remainingSetup: number;
  monthlyPct: number;
  /** Future monthly service; null when usage needs a custom quote. */
  monthly: number | null;
  hasCustom: boolean;
}

export interface PilotQuote {
  mode: "pilot";
  empty: false;
  /** No implementation lines: a pilot is not a fully implemented module. */
  lines: [];
  id: ModuleId;
  info: PilotInfo;
  fee: number;
  days: number;
  usage: number;
  customers: number | null;
  credit: number;
  creditDays: number;
  conversion: PilotConversion;
}

export type Quote =
  | PilotQuote
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

export function apPilotConversion(sel: Selection, P: Pricing): PilotConversion {
  const pilotId = sel.pilot;
  const ids = [pilotId, ...AP_MODULES.map((m) => m.id).filter((id) => id !== pilotId && (sel.convertWith || []).includes(id))];
  const modules = {} as Record<ModuleId, ModuleSel>;
  AP_MODULES.forEach((m) => {
    modules[m.id] = { on: ids.includes(m.id), usage: sel.modules[m.id].usage };
  });
  // Reuse the standard modular pricing (tiers + bundle discounts) for the future implementation.
  const q = apComputeQuote({ ...sel, mode: "modular", modules }, P);
  if (q.mode !== "modular" || q.empty) throw new Error("conversion needs at least the piloted module");
  const creditAvailable = apNum(P.pilots[pilotId].credit);
  // The credit is applied once, against the (possibly discounted) setup, and never below zero.
  const creditApplied = Math.min(creditAvailable, q.setupNet);
  return {
    pilotId,
    modules: ids,
    lines: q.lines,
    setupOrig: q.setupOrig,
    setupPct: q.setupPct,
    setupNet: q.setupNet,
    creditAvailable,
    creditApplied,
    remainingSetup: apCents(Math.max(0, q.setupNet - creditApplied)),
    monthlyPct: q.monthlyPct,
    monthly: q.monthlyNet,
    hasCustom: q.hasCustom,
  };
}

export function apComputeQuote(sel: Selection, P: Pricing): Quote {
  if (sel.mode === "pilot") {
    const id = sel.pilot;
    const pp = P.pilots[id];
    return {
      mode: "pilot",
      empty: false,
      lines: [],
      id,
      info: AP_PILOT_INFO[id],
      fee: apNum(pp.price),
      days: apNum(pp.days),
      usage: apNum(pp.usage),
      customers: id === "journey" ? apNum(pp.customers) : null,
      credit: apNum(pp.credit),
      creditDays: apNum(P.pilotCreditDays),
      conversion: apPilotConversion(sel, P),
    };
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
  if (q.mode === "pilot") {
    const c = q.conversion;
    out.push(`Starter Pilot: ${q.info.name}`);
    out.push(`One-time pilot fee: ${q.info.startingAt ? "starting at " : ""}${apFmt(q.fee)}${q.info.startingAt ? " (subject to final technical scope and security requirements)" : ""}`);
    out.push(`Duration: ${q.days} days${q.info.durationNote ? ` ${q.info.durationNote}` : ""}`);
    out.push(`Included: up to ${q.usage} ${q.info.usageUnit}${q.customers != null ? `, up to ${q.customers} invited customers` : ""}`);
    out.push("No automatic monthly subscription.");
    out.push(`Implementation credit: ${apFmt(q.credit)} toward the full setup fee if signed within ${q.creditDays} days of pilot completion.`);
    out.push("", "Optional future implementation (not due now):");
    out.push(`Standard setup: ${apFmt(c.setupOrig)}${c.setupPct ? ` (${c.setupPct}% bundle discount → ${apFmt(c.setupNet)})` : ""}`);
    out.push(`Pilot credit: ${apFmt(-c.creditApplied)}`);
    out.push(`Remaining setup: ${apFmt(c.remainingSetup)}`);
    out.push(`Monthly service: ${c.monthly == null ? "Custom quote required" : apFmt(c.monthly)}`);
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
    const { partner: _dropped, ...savedPricing } = r.pricing;
    void _dropped;
    const pricing: Pricing = { ...base.pricing, ...savedPricing };
    const modules = {} as Record<ModuleId, ModuleSel>;
    AP_MODULES.forEach((m) => {
      pricing[m.id] = { ...base.pricing[m.id], ...(r.pricing[m.id] || {}) };
      modules[m.id] = { ...base.sel.modules[m.id], ...((r.sel.modules || {})[m.id] || {}) };
    });
    const pilots = {} as Pricing["pilots"];
    AP_MODULES.forEach((m) => {
      pilots[m.id] = { ...base.pricing.pilots[m.id], ...((r.pricing.pilots || {})[m.id] || {}) };
    });
    pricing.pilots = pilots;
    const ids = AP_MODULES.map((m) => m.id);
    // A saved partnership selection (no longer offered) loads as Modular.
    const mode: Mode = r.sel.mode === "pilot" ? "pilot" : "modular";
    return {
      sel: {
        mode,
        modules,
        pilot: ids.includes(r.sel.pilot) ? r.sel.pilot : base.sel.pilot,
        convertWith: Array.isArray(r.sel.convertWith) ? r.sel.convertWith.filter((x: ModuleId) => ids.includes(x)) : [],
      },
      pricing,
    };
  } catch {
    return base;
  }
}
