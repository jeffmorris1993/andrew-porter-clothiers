"use client";

/* Port of ap-proposal.jsx — the one-page client proposal (Page 1). */

import { useEffect, useRef, useState } from "react";
import { AP_MODULES, AP_TIERS, AP_TIER_LABEL, apFmt, apNum, type ModuleId, type Pricing, type Quote, type Tier } from "@/lib/proposal/pricing";

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
  if (quote.mode === "partner") {
    return (
      <div className="pp-inv-body">
        <div className="pp-inv-lines">
          <div className="pp-inv-line pp-inv-head">
            <span>Sirrom AI Technology Partnership</span>
          </div>
          {quote.lines.map((l) => (
            <div className="pp-inv-line" key={l.id}>
              <span>{l.mod.name}</span>
              <span className="pp-inv-meta">
                Medium · up to {l.mod.limits[1]} {l.mod.unit} / month
              </span>
            </div>
          ))}
          {quote.overMedium.length > 0 && (
            <div className="pp-inv-note">Expected usage above Medium allowances will be addressed through a custom usage adjustment.</div>
          )}
        </div>
        <div className="pp-figs">
          <PPFigure label="Separate setup" value="$0" />
          <PPFigure label="Monthly retainer" value={apFmt(quote.monthly)} />
          <PPFigure label="12-month contract" value={apFmt(quote.firstYear)} />
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

export function ProposalSheet({ quote, pricing: P }: { quote: Quote; pricing: Pricing }) {
  const partner = quote.mode === "partner";
  const tierOf = (id: ModuleId): Tier | null => {
    if (partner) return "medium";
    const l = quote.lines.find((x) => x.id === id);
    return l && "tier" in l ? l.tier : null;
  };
  const n = partner ? 0 : quote.lines.length;
  return (
    <div className="pp-sheet" data-screen-label="Page 1 — Client Proposal" data-testid="proposal-sheet">
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

      <section>
        <PPSec n="I" t="Choose Your Solutions" />
        <div className="pp-mods">
          {AP_MODULES.map((m) => {
            const on = !!tierOf(m.id);
            return (
              <div className={"pp-mod" + (on ? " on" : "")} key={m.id}>
                <div className="pp-mod-top">
                  <h3>{m.name}</h3>
                  {on && <span className="pp-flag">{partner ? "Included" : "Selected"}</span>}
                </div>
                <p>{m.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <PPSec n="II" t="Pricing Options" />
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
            {AP_MODULES.map((m) => {
              const t = tierOf(m.id);
              return (
                <tr key={m.id}>
                  <td className="pp-t-name">
                    {m.name}
                    <span className="pp-note">{m.note || " "}</span>
                  </td>
                  <td className={"pp-t-price" + (t && !partner ? " on" : "")}>
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
        <p className="pp-t-foot">Usage allowances are per month.</p>
      </section>

      <div className="pp-row">
        <section className="pp-bundle">
          <PPSec n="III" t="Bundle Savings" />
          <div className={"pp-b-item" + (n === 2 ? " on" : "")}>
            <div className="pp-b-k">Choose 2 modules</div>
            <div className="pp-b-v">{apNum(P.disc2)}% off setup and monthly fees</div>
            {n === 2 && <span className="pp-flag">Applied</span>}
          </div>
          <div className={"pp-b-item" + (n === 3 ? " on" : "")}>
            <div className="pp-b-k">Choose all 3 modules</div>
            <div className="pp-b-v">
              {apNum(P.disc3Setup)}% off setup and {apNum(P.disc3Monthly)}% off monthly fees
            </div>
            {n === 3 && <span className="pp-flag">Applied</span>}
          </div>
          <p className="pp-b-foot">Savings are calculated automatically on your selected investment below.</p>
        </section>

        <section className={"pp-partner" + (partner ? " on" : "")}>
          <div className="pp-p-top">
            <div className="pp-p-label">
              <span className="pp-pn">IV</span> AI Technology Partner
            </div>
            {partner && <span className="pp-flag pp-flag-inv">Selected</span>}
          </div>
          <div className="pp-p-hd">
            <h2>Sirrom AI Technology Partnership</h2>
            <div className="pp-p-price">
              {apFmt(apNum(P.partner))}
              <i>/month</i>
            </div>
          </div>
          <ul>
            <li>All three modules at Medium usage allowances</li>
            <li>No separate module setup fees</li>
            <li>Initial implementation and onboarding</li>
            <li>Hosting, maintenance, and included AI usage</li>
            <li>Monthly technology strategy meeting</li>
            <li>Up to 2 hours of small improvements per month</li>
          </ul>
          <p className="pp-p-req">
            Requires a 12-month agreement. An alternative to purchasing individual modules, not an extra charge on top of a bundle.
          </p>
          <p className="pp-p-fine">Additional major development and premium third-party data subscriptions are quoted separately.</p>
        </section>
      </div>

      <section className="pp-inv">
        <PPSec n="V" t="Your Selected Investment" />
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
