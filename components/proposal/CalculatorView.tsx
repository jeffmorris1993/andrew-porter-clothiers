"use client";

/* Port of ap-calculator.jsx — the internal pricing configuration (Page 2). */

import { useRef, useState } from "react";
import {
  AP_DEFAULT_PRICING,
  AP_DEFAULT_SEL,
  AP_MODULES,
  AP_TIERS,
  AP_TIER_LABEL,
  apClone,
  apFmt,
  apNum,
  apQuoteText,
  apRange,
  apTier,
  type ApModule,
  type ApState,
  type ModuleId,
  type ModuleSel,
  type Num,
  type Pricing,
  type Quote,
} from "@/lib/proposal/pricing";
import { PilotConversion, PilotPicker, PilotSettings, PilotSummary } from "./PilotPanels";
import { SIRROM_LOGO } from "./ProposalSheet";

function CXSwitch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={"cx-switch" + (on ? " on" : "")} onClick={() => onChange(!on)}>
      <span></span>
    </button>
  );
}

export function CXNumber({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  label,
}: {
  value: Num;
  onChange: (v: Num) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  label?: string;
}) {
  return (
    <label className="cx-field">
      {label && <span className="cx-field-l">{label}</span>}
      <span className="cx-field-box">
        {prefix && <span className="cx-affix">{prefix}</span>}
        <input
          type="number"
          min="0"
          step={step}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
        />
        {suffix && <span className="cx-affix">{suffix}</span>}
      </span>
    </label>
  );
}

export function CXModuleCard({
  m,
  ms,
  P,
  partner,
  setModule,
  conversion = false,
}: {
  m: ApModule;
  ms: ModuleSel;
  P: Pricing;
  partner: boolean;
  setModule: (id: ModuleId, patch: Partial<ModuleSel>) => void;
  /** Starter Pilot conversion: usage only, no on/off switch. */
  conversion?: boolean;
}) {
  const u = apNum(ms.usage);
  const tier = apTier(u, m.limits);
  const active = partner || ms.on || conversion;
  const set = (v: Num | string) => setModule(m.id, { usage: v === "" ? "" : Math.max(0, Math.round(Number(v))) });
  let status: React.ReactNode;
  if (partner) {
    status =
      u > m.limits[1] ? (
        <div className="cx-status warn">
          Exceeds the Medium allowance of {m.limits[1]}. The retainer requires a custom usage adjustment.
        </div>
      ) : (
        <div className="cx-status ok">Included in partnership · within Medium allowance ({m.limits[1]})</div>
      );
  } else if (tier === "custom") {
    status = (
      <div className="cx-status warn">
        <b>Custom Quote Required</b> — usage above the High allowance of {m.limits[2]}.
      </div>
    );
  } else {
    status = (
      <div className="cx-status">
        <b>{AP_TIER_LABEL[tier]}</b> · {apFmt(apNum(P[m.id][tier]))}/mo{ms.on || conversion ? "" : " (not selected)"}
      </div>
    );
  }
  return (
    <div className={"cx-mod" + (active ? " on" : "")} data-testid={`module-${m.id}`}>
      <div className="cx-mod-head">
        {partner ? (
          <span className="cx-incl">Included</span>
        ) : conversion ? (
          <span className="cx-incl">After the pilot</span>
        ) : (
          <CXSwitch on={ms.on} label={"Select " + m.name} onChange={(v) => setModule(m.id, { on: v })} />
        )}
        <div className="cx-mod-name">{m.name}</div>
        <div className="cx-mod-setup">{partner ? "No setup fee" : `${conversion ? "Standard setup" : "Setup"} ${apFmt(apNum(P[m.id].setup))}`}</div>
      </div>
      <div className="cx-mod-body">
        <div className="cx-q">{m.question}</div>
        <div className="cx-usage">
          <div className="cx-step">
            <button type="button" aria-label={`Decrease ${m.short}`} onClick={() => set(Math.max(0, u - 1))}>
              −
            </button>
            <input type="number" min="0" inputMode="numeric" value={ms.usage} onChange={(e) => set(e.target.value)} aria-label={m.question} />
            <button type="button" aria-label={`Increase ${m.short}`} onClick={() => set(u + 1)}>
              +
            </button>
          </div>
          <div className="cx-tiers">
            {AP_TIERS.map((t, i) => (
              <div key={t.id} className={"cx-tier" + (tier === t.id ? " on" : "") + (partner && t.id === "medium" ? " incl" : "")}>
                <span>{t.label}</span>
                <small>{apRange(m.limits, i)}</small>
              </div>
            ))}
            <div className={"cx-tier" + (tier === "custom" ? " on warn" : "")}>
              <span>Custom</span>
              <small>{m.limits[2]}+</small>
            </div>
          </div>
        </div>
        {status}
      </div>
    </div>
  );
}

export function CXRow({ k, v, strong, minus }: { k: string; v: string; strong?: boolean; minus?: boolean }) {
  return (
    <div className={"cx-row" + (strong ? " strong" : "")}>
      <span>{k}</span>
      <span className={minus ? "minus" : ""}>{v}</span>
    </div>
  );
}

function CXSummary({ quote, P }: { quote: Quote; P: Pricing }) {
  if (quote.mode === "pilot") return <PilotSummary quote={quote} />;
  if (quote.mode === "partner") {
    return (
      <div className="cx-sum-body">
        <div className="cx-sum-sel">
          {quote.lines.map((l) => (
            <div key={l.id} className="cx-sum-line">
              <span>{l.mod.name}</span>
              <span className={l.over ? "warn" : ""}>
                {l.usage} / {l.mod.limits[1]} {l.over ? "· over Medium" : "· Medium"}
              </span>
            </div>
          ))}
        </div>
        <CXRow k="Separate setup" v="$0" />
        <CXRow k="Monthly retainer" v={apFmt(quote.monthly)} />
        <CXRow k="Contract term" v="12 months" />
        <CXRow k="First-year contract value" v={apFmt(quote.firstYear)} strong />
        {quote.overMedium.length > 0 && (
          <div className="cx-alert">
            Entered usage exceeds Medium allowances for {quote.overMedium.map((l) => l.mod.name).join(", ")}. The retainer requires a custom
            usage adjustment; High usage is not automatically included.
          </div>
        )}
      </div>
    );
  }
  if (quote.empty) return <div className="cx-sum-empty">Select at least one module to build a quote.</div>;
  const custom = "Custom Quote Required";
  return (
    <div className="cx-sum-body">
      <div className="cx-sum-sel">
        {quote.lines.map((l) => (
          <div key={l.id} className="cx-sum-line">
            <span>{l.mod.name}</span>
            <span className={l.tier === "custom" ? "warn" : ""}>
              {l.tier === "custom" ? custom : `${AP_TIER_LABEL[l.tier]} · ${apFmt(l.price)}/mo`}
            </span>
          </div>
        ))}
      </div>
      <div className="cx-sum-group">
        <CXRow k="Original combined setup" v={apFmt(quote.setupOrig)} />
        <CXRow k={`Setup discount (${quote.setupPct}%)`} v={quote.setupDisc ? apFmt(-quote.setupDisc) : "$0"} minus={!!quote.setupDisc} />
        <CXRow k="Discounted setup total" v={apFmt(quote.setupNet)} strong />
      </div>
      <div className="cx-sum-group">
        <CXRow k="Original combined monthly" v={quote.hasCustom ? custom : apFmt(quote.monthlyOrig)} />
        <CXRow
          k={`Monthly discount (${quote.monthlyPct}%)`}
          v={quote.hasCustom ? "—" : quote.monthlyDisc ? apFmt(-quote.monthlyDisc) : "$0"}
          minus={!!quote.monthlyDisc}
        />
        <CXRow k="Discounted monthly total" v={quote.hasCustom ? custom : apFmt(quote.monthlyNet)} strong />
      </div>
      <div className="cx-total">
        <span>First-year total</span>
        <b data-testid="first-year-total">{quote.firstYear == null ? custom : apFmt(quote.firstYear)}</b>
      </div>
      <div className="cx-sum-hint">
        {quote.n === 1 && `Add a second module to unlock ${apNum(P.disc2)}% off setup and monthly.`}
        {quote.n === 2 &&
          `2-module bundle applied. Add the third for ${apNum(P.disc3Setup)}% off setup and ${apNum(P.disc3Monthly)}% off monthly.`}
        {quote.n === 3 && "3-module bundle applied."}
        {(quote.setupPct > 0 || quote.monthlyPct > 0) && " Discounted totals are rounded to the nearest $5."}
      </div>
    </div>
  );
}

function CXAdvanced({ P, setPricing, onReset }: { P: Pricing; setPricing: (fn: (p: Pricing) => Pricing) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const setMod = (id: ModuleId, k: "setup" | "low" | "medium" | "high", v: Num) => setPricing((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const setTop = (k: "disc2" | "disc3Setup" | "disc3Monthly" | "partner", v: Num) => setPricing((p) => ({ ...p, [k]: v }));
  return (
    <section className="cx-sec">
      <button type="button" className="cx-collapse" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="cx-sec-t">Advanced Pricing Settings</span>
        <span className="cx-chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="cx-adv">
          {AP_MODULES.map((m) => (
            <div className="cx-adv-mod" key={m.id}>
              <div className="cx-adv-name">{m.name}</div>
              <div className="cx-adv-grid">
                <CXNumber label="Setup" prefix="$" value={P[m.id].setup} onChange={(v) => setMod(m.id, "setup", v)} />
                {AP_TIERS.map((t) => (
                  <CXNumber key={t.id} label={t.label + " /mo"} prefix="$" value={P[m.id][t.id]} onChange={(v) => setMod(m.id, t.id, v)} />
                ))}
              </div>
            </div>
          ))}
          <div className="cx-adv-mod">
            <div className="cx-adv-name">Bundle discounts &amp; partnership</div>
            <div className="cx-adv-grid">
              <CXNumber label="2 modules" suffix="%" value={P.disc2} onChange={(v) => setTop("disc2", v)} />
              <CXNumber label="3 modules · setup" suffix="%" value={P.disc3Setup} onChange={(v) => setTop("disc3Setup", v)} />
              <CXNumber label="3 modules · monthly" suffix="%" value={P.disc3Monthly} onChange={(v) => setTop("disc3Monthly", v)} />
              <CXNumber label="Partner retainer /mo" prefix="$" value={P.partner} onChange={(v) => setTop("partner", v)} />
            </div>
          </div>
          <PilotSettings P={P} setPricing={setPricing} />
          <div className="cx-adv-foot">
            <button type="button" className="cx-btn ghost" onClick={onReset}>
              Reset to Default Pricing
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CalculatorView({
  state,
  setState,
  quote,
  onView,
  onExport,
}: {
  state: ApState;
  setState: (fn: (s: ApState) => ApState) => void;
  quote: Quote;
  onView: () => void;
  onExport: () => void;
}) {
  const { sel, pricing: P } = state;
  const partner = sel.mode === "partner";
  const pilot = sel.mode === "pilot";
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flash = (t: string) => {
    setToast(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2200);
  };
  const setModule = (id: ModuleId, patch: Partial<ModuleSel>) =>
    setState((s) => ({ ...s, sel: { ...s.sel, modules: { ...s.sel.modules, [id]: { ...s.sel.modules[id], ...patch } } } }));
  const setMode = (mode: "modular" | "pilot" | "partner") => setState((s) => ({ ...s, sel: { ...s.sel, mode } }));
  const setPricing = (fn: (p: Pricing) => Pricing) => setState((s) => ({ ...s, pricing: fn(s.pricing) }));
  const copy = async () => {
    const text = apQuoteText(quote);
    try {
      await navigator.clipboard.writeText(text);
      flash("Quote copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      flash(ok ? "Quote copied to clipboard" : "Copy failed — clipboard unavailable");
    }
  };
  const resetCalc = () => {
    setState((s) => ({ ...s, sel: apClone(AP_DEFAULT_SEL) }));
    flash("Calculator reset");
  };
  const resetPricing = () => {
    setPricing(() => apClone(AP_DEFAULT_PRICING));
    flash("Default pricing restored");
  };

  return (
    <div className="cx screen-only" data-screen-label="Page 2 — Pricing Configuration">
      <div className="cx-bar">
        <div className="cx-bar-in">
          <div className="cx-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
            <img src={SIRROM_LOGO} alt="Sirrom Studios" />
            <span className="cx-internal">Internal</span>
          </div>
          <div className="cx-actions">
            <button type="button" className="cx-btn primary" onClick={onView}>
              View Client Proposal
            </button>
            <button type="button" className="cx-btn" onClick={onExport}>
              Export Client Proposal PDF
            </button>
            <button type="button" className="cx-btn" onClick={copy}>
              Copy Quote
            </button>
            <button type="button" className="cx-btn ghost" onClick={resetCalc}>
              Reset Calculator
            </button>
          </div>
        </div>
      </div>

      <div className="cx-wrap">
        <header className="cx-head">
          <div className="cx-eyebrow">Andrew Porter Fine Clothiers</div>
          <h1>Pricing Configuration</h1>
          <p>Adjust the package during discovery and watch the client proposal update automatically.</p>
        </header>

        <div className="cx-grid">
          <div className="cx-main">
            <section className="cx-sec">
              <div className="cx-sec-t">Pricing Model</div>
              <div className="cx-seg three" role="radiogroup" aria-label="Pricing model">
                <button
                  type="button"
                  role="radio"
                  aria-checked={sel.mode === "modular"}
                  className={sel.mode === "modular" ? "on" : ""}
                  onClick={() => setMode("modular")}
                >
                  <b>Modular Implementation</b>
                  <small>Select modules · setup + monthly by usage</small>
                </button>
                <button type="button" role="radio" aria-checked={pilot} className={pilot ? "on" : ""} onClick={() => setMode("pilot")}>
                  <b>Starter Pilot</b>
                  <small>One module · one-time fee · no subscription</small>
                </button>
                <button type="button" role="radio" aria-checked={partner} className={partner ? "on" : ""} onClick={() => setMode("partner")}>
                  <b>AI Technology Partnership</b>
                  <small>{apFmt(apNum(P.partner))}/mo · $0 setup · 12-month contract</small>
                </button>
              </div>
            </section>

            {quote.mode === "pilot" && (
              <>
                <PilotPicker state={state} setState={setState} quote={quote} />
                <PilotConversion state={state} setState={setState} quote={quote} />
              </>
            )}

            <section className="cx-sec" hidden={pilot}>
              <div className="cx-sec-t">{partner ? "Expected Monthly Usage" : "Select Modules & Expected Monthly Usage"}</div>
              {partner && (
                <p className="cx-sec-note">
                  The partnership includes all three modules at Medium allowances. Enter expected usage to confirm it fits.
                </p>
              )}
              <div className="cx-mods">
                {AP_MODULES.map((m) => (
                  <CXModuleCard key={m.id} m={m} ms={sel.modules[m.id]} P={P} partner={partner} setModule={setModule} />
                ))}
              </div>
            </section>

            <CXAdvanced P={P} setPricing={setPricing} onReset={resetPricing} />
          </div>

          <aside className="cx-side">
            <section className="cx-sum" data-testid="quote-summary">
              <div className="cx-sum-head">
                <span className="cx-sec-t">Live Quote Summary</span>
                <span className="cx-sum-mode">{partner ? "Partnership" : pilot ? "Starter Pilot" : "Modular"}</span>
              </div>
              <CXSummary quote={quote} P={P} />
            </section>
          </aside>
        </div>
      </div>
      {toast && (
        <div className="cx-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
