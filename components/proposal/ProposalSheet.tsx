"use client";

/* Port of ap-proposal.jsx — the one-page client proposal (Page 1). */

import { useEffect, useRef, useState } from "react";
import {
  AP_MODULES,
  AP_TIERS,
  AP_TIER_LABEL,
  apFmt,
  apNum,
  type ModuleId,
  type Pricing,
  type Quote,
  type Tier,
} from "@/lib/proposal/pricing";

export const SIRROM_LOGO = "/proposal/sirrom-lockup-ink.png";

function PPSec({ n, t }: { n: string; t: string }) {
  return (
    <div className="pp-sec">
      <span className="pp-sec-n">{n}</span>
      <span className="pp-sec-t">{t}</span>
      <span className="pp-sec-rule"></span>
    </div>
  );
}

function PPFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="pp-fig">
      <div className="pp-fig-l">{label}</div>
      <div className="pp-fig-v" data-testid={`fig-${label}`}>
        {value}
      </div>
    </div>
  );
}

function PPInvestment({ quote }: { quote: Quote }) {
  if (quote.mode === "pilot") {
    return (
      <div className="pp-inv-body" data-testid="pilot-investment">
        <div className="pp-inv-lines">
          <div className="pp-inv-line pp-inv-head">
            <span>{quote.info.name}</span>
            <span className="pp-inv-meta">Starter Pilot</span>
          </div>
          <div className="pp-inv-detail">
            Up to {quote.usage} {quote.info.usageUnit}
            {quote.customers != null ? ` · up to ${quote.customers} invited customers` : ""}
            {quote.info.durationNote ? ` · ${quote.days} days ${quote.info.durationNote}` : ""}
          </div>
          <div className="pp-inv-note">
            No automatic monthly subscription. Continuing to a full implementation is optional and needs a separate agreement.
            {quote.info.startingAt ? " Final fee depends on technical scope and security requirements." : ""}
          </div>
        </div>
        <div className="pp-figs">
          <PPFigure label={quote.info.startingAt ? "Pilot · starting at" : "One-time pilot"} value={apFmt(quote.fee)} />
          <PPFigure label="Duration" value={`${quote.days} days`} />
          <PPFigure label="Implementation credit" value={apFmt(quote.credit)} />
        </div>
      </div>
    );
  }
  if (quote.empty) return <div className="pp-inv-empty">Your personalized investment will appear here.</div>;
  return (
    <div className="pp-inv-body">
      <div className="pp-inv-lines">
        {quote.lines.map((l) => (
          <div className="pp-inv-line" key={l.id}>
            <span>{l.mod.name}</span>
            <span className="pp-inv-meta">
              {l.tier === "custom"
                ? "Custom usage · quoted individually"
                : `${AP_TIER_LABEL[l.tier]} · up to ${l.mod.limits[["low", "medium", "high"].indexOf(l.tier)]} ${l.mod.unit} / month`}
            </span>
          </div>
        ))}
        {(quote.setupPct > 0 || quote.monthlyPct > 0) && (
          <div className="pp-inv-note">
            Bundle savings applied: {quote.setupPct}% off setup, {quote.monthlyPct}% off monthly fees
            {quote.savings != null && quote.savings > 0 ? ` — ${apFmt(quote.savings)} saved in the first year.` : "."}
          </div>
        )}
        {quote.hasCustom && <div className="pp-inv-note">Usage beyond the High allowance is quoted individually.</div>}
      </div>
      <div className="pp-figs">
        <PPFigure label="One-time setup" value={apFmt(quote.setupNet)} />
        <PPFigure label="Monthly service" value={quote.monthlyNet == null ? "Custom quote" : apFmt(quote.monthlyNet)} />
        <PPFigure label="First-year total" value={quote.firstYear == null ? "Custom quote" : apFmt(quote.firstYear)} />
      </div>
    </div>
  );
}

/** The chosen Starter Pilot, presented on its own. */
function PPPilot({ quote, P, n }: { quote: Extract<Quote, { mode: "pilot" }>; P: Pricing; n: string }) {
  const info = quote.info;
  return (
    <section className="pp-pilots-sec" data-testid="pp-pilots">
      <PPSec n={n} t="Start Small. Prove the Value." />
      <p className="pp-pilot-intro">
        Not ready for a full implementation? Choose one capability to test in your business before making a larger commitment.
      </p>
      <div className="pp-pilot-one">
        <div className="pp-pilot-one-hd">
          <div>
            <h3>{info.name}</h3>
            <div className="pp-pilot-meta">
              {quote.days} days{info.durationNote ? ` ${info.durationNote}` : ""}
            </div>
          </div>
          <div className="pp-pilot-one-price">
            {info.startingAt && <span>Starting at </span>}
            {apFmt(quote.fee)}
            <i> one-time</i>
          </div>
        </div>
        <div className="pp-pilot-facts">
          <div>
            <span>Included usage</span>
            <b>
              Up to {quote.usage} {info.usageUnit}
              {quote.customers != null ? ` · up to ${quote.customers} invited customers` : ""}
            </b>
          </div>
          <div>
            <span>Implementation credit</span>
            <b>
              {apFmt(quote.credit)} toward full setup if signed within {apNum(P.pilotCreditDays)} days of completion
            </b>
          </div>
        </div>
        <div className="pp-pilot-lists">
          <div>
            <div className="pp-b-k">What&apos;s included</div>
            <ul>
              {info.included.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="pp-b-k">Not included</div>
            <ul>
              {info.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        {info.prerequisites && (
          <p className="pp-pilot-req">
            Real invited customers join once secure production access is in place — {info.prerequisites.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}. The final fee
            depends on technical scope and security requirements.
          </p>
        )}
      </div>
      <p className="pp-pilot-fine">
        One-time fee with no automatic subscription and no recurring fees during the pilot. Access ends when the pilot expires unless a
        separate agreement is signed. A pilot is not a fully implemented module.
      </p>
    </section>
  );
}

export function ProposalSheet({ quote, pricing: P }: { quote: Quote; pricing: Pricing }) {
  const modular = quote.mode === "modular";
  const tierOf = (id: ModuleId): Tier | null => {
    const l = quote.lines.find((x) => x.id === id);
    return l && "tier" in l ? l.tier : null;
  };
  const n = modular ? quote.lines.length : 0;
  // Page 1 shows only what was chosen on Page 2.
  const shown = modular && quote.empty ? AP_MODULES : AP_MODULES.filter((m) => tierOf(m.id));
  const numerals = ["I", "II", "III", "IV", "V", "VI"];
  let sec = 0;
  const next = () => numerals[sec++];
  return (
    <div className="pp-sheet" data-screen-label="Page 1 — Client Proposal" data-testid="proposal-sheet" data-mode={quote.mode}>
      <header className="pp-head">
        {/* eslint-disable-next-line @next/next/no-img-element -- print sheet needs a plain img */}
        <img src={SIRROM_LOGO} alt="Sirrom Studios" />
        <div className="pp-head-r">Pricing Proposal · Andrew Porter Fine Clothiers</div>
      </header>
      <div className="pp-title">
        <h1>Your Business. More Connected.</h1>
        <p className="pp-sub">AI Technology Solutions for Andrew Porter Fine Clothiers</p>
        <p className="pp-by">Presented by Sirrom Studios</p>
      </div>

      {quote.mode !== "pilot" && (
        <section>
          <PPSec n={next()} t={n ? "Your Solutions" : "Choose Your Solutions"} />
          <div className="pp-mods" style={{ gridTemplateColumns: `repeat(${shown.length},minmax(0,1fr))` }}>
            {shown.map((m) => {
              const on = !!tierOf(m.id);
              return (
                <div className={"pp-mod" + (on ? " on" : "")} key={m.id}>
                  <div className="pp-mod-top">
                    <h3>{m.name}</h3>
                    {on && <span className="pp-flag">Selected</span>}
                  </div>
                  <p>{m.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {modular && (
        <section>
          <PPSec n={next()} t={n ? "Your Pricing" : "Pricing Options"} />
          <table className="pp-table">
            <thead>
              <tr>
                <th>Solution</th>
                <th>One-Time Setup</th>
                <th>Low Usage</th>
                <th>Medium Usage</th>
                <th>High Usage</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const t = tierOf(m.id);
                return (
                  <tr key={m.id}>
                    <td className="pp-t-name">
                      {m.name}
                      <span className="pp-note">{m.note || "\u00a0"}</span>
                    </td>
                    <td className={"pp-t-price" + (t ? " on" : "")}>
                      <b>{apFmt(apNum(P[m.id].setup))}</b>
                    </td>
                    {AP_TIERS.map((tier, i) => (
                      <td key={tier.id} className={"pp-t-price" + (t === tier.id ? " on" : "")}>
                        <b>
                          {apFmt(apNum(P[m.id][tier.id]))}
                          <i>/mo</i>
                        </b>
                        <span className="pp-al">
                          {m.limits[i]} {m.unit}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pp-t-foot">Usage allowances are per month. Your expected usage is highlighted.</p>
        </section>
      )}

      {modular && n >= 2 && (
        <section className="pp-bundle">
          <PPSec n={next()} t="Bundle Savings" />
          <div className="pp-b-item on">
            <div className="pp-b-k">{n === 2 ? "2-module bundle" : "All 3 modules"}</div>
            <div className="pp-b-v">
              {n === 2
                ? `${apNum(P.disc2)}% off setup and monthly fees`
                : `${apNum(P.disc3Setup)}% off setup and ${apNum(P.disc3Monthly)}% off monthly fees`}
            </div>
            <span className="pp-flag">Applied</span>
          </div>
        </section>
      )}

      {quote.mode === "pilot" && <PPPilot quote={quote} P={P} n={next()} />}


      <section className="pp-inv">
        <PPSec n={next()} t="Your Selected Investment" />
        <PPInvestment quote={quote} />
      </section>

      <footer className="pp-foot">
        Pricing is illustrative and subject to final implementation scope, usage limits, and service agreement. Third-party premium data
        licensing and major integrations are quoted separately.
      </footer>
    </div>
  );
}

export function ProposalView({
  quote,
  pricing,
  onConfigure,
  onExport,
}: {
  quote: Quote;
  pricing: Pricing;
  onConfigure: () => void;
  onExport: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 32) / 816)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="pv screen-only" ref={ref}>
      <div className="pv-bar">
        <button className="pv-link" onClick={onConfigure}>
          ← Configure
        </button>
        <button className="pv-link" onClick={onExport}>
          Export PDF
        </button>
      </div>
      <div className="pv-frame" style={{ width: 816 * scale, height: 1056 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <ProposalSheet quote={quote} pricing={pricing} />
        </div>
      </div>
    </div>
  );
}
