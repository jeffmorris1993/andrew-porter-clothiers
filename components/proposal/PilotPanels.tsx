"use client";

/* Starter Pilot additions to Page 2 (internal calculator). Uses the design's
   existing cx-* building blocks so it looks like the rest of the calculator. */

import {
  AP_MODULES,
  AP_PILOT_INFO,
  AP_PILOT_RULES,
  apFmt,
  apNum,
  type ApState,
  type ModuleId,
  type ModuleSel,
  type Num,
  type PilotQuote,
  type Pricing,
} from "@/lib/proposal/pricing";
import { CXModuleCard, CXNumber, CXRow } from "./CalculatorView";

type SetState = (fn: (s: ApState) => ApState) => void;

const modName = (id: ModuleId) => AP_MODULES.find((m) => m.id === id)!.name;

/** One-time fee wording, e.g. "Starting at $3,500". */
export function pilotFeeLabel(q: Pick<PilotQuote, "fee" | "info">, short = false) {
  return q.info.startingAt ? `${short ? "From" : "Starting at"} ${apFmt(q.fee)}` : apFmt(q.fee);
}

export function pilotUsageLabel(q: Pick<PilotQuote, "usage" | "info" | "customers">) {
  return `Up to ${q.usage} ${q.info.usageUnit}${q.customers != null ? ` · up to ${q.customers} invited customers` : ""}`;
}

export function PilotPicker({ state, setState, quote }: { state: ApState; setState: SetState; quote: PilotQuote }) {
  const P = state.pricing;
  const choose = (id: ModuleId) =>
    setState((s) => ({ ...s, sel: { ...s.sel, pilot: id, convertWith: s.sel.convertWith.filter((x) => x !== id) } }));
  return (
    <section className="cx-sec" data-testid="pilot-picker">
      <div className="cx-sec-t">Choose One Pilot</div>
      <p className="cx-sec-note">One capability, a fixed one-time fee and a limited evaluation period. Only one pilot at a time.</p>
      <div className="cx-seg three" role="radiogroup" aria-label="Starter Pilot">
        {AP_MODULES.map((m) => {
          const info = AP_PILOT_INFO[m.id];
          const pp = P.pilots[m.id];
          const on = state.sel.pilot === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} className={on ? "on" : ""} onClick={() => choose(m.id)}>
              <b>{m.name}</b>
              <small>
                {info.startingAt ? "From " : ""}
                {apFmt(apNum(pp.price))} · {apNum(pp.days)} days
              </small>
            </button>
          );
        })}
      </div>

      <div className="cx-pilot" data-testid="pilot-detail">
        <div className="cx-pilot-head">
          <div>
            <div className="cx-pilot-name">{quote.info.name}</div>
            <div className="cx-pilot-dur">
              {quote.days} days {quote.info.durationNote}
            </div>
          </div>
          <div className="cx-pilot-price">
            {quote.info.startingAt && <small>Starting at</small>}
            {apFmt(quote.fee)}
            <small>one-time</small>
          </div>
        </div>
        {quote.info.startingAt && (
          <div className="cx-status warn">Starting price — final fee depends on technical scope and security requirements.</div>
        )}
        <div className="cx-pilot-cols">
          <div>
            <div className="cx-pilot-k">Included</div>
            <ul>
              <li>{pilotUsageLabel(quote)}</li>
              {quote.info.included.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="cx-pilot-k">Limitations</div>
            <ul>
              {quote.info.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="cx-pilot-k">Implementation credit</div>
            <p>
              {apFmt(quote.credit)} toward the full {modName(quote.id)} setup fee if Andrew signs within {quote.creditDays} days of pilot
              completion.
            </p>
          </div>
        </div>
        {quote.info.prerequisites && (
          <div className="cx-pilot-req" data-testid="pilot-prereqs">
            <div className="cx-pilot-k">Before real customers are invited</div>
            <p>
              This is a limited live deployment with real invited customers — the demo&apos;s browser storage is not suitable. Production
              requirements: {quote.info.prerequisites.join("; ")}.
            </p>
          </div>
        )}
        <ul className="cx-pilot-rules">
          {AP_PILOT_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PilotConversion({ state, setState, quote }: { state: ApState; setState: SetState; quote: PilotQuote }) {
  const c = quote.conversion;
  const P = state.pricing;
  const setModule = (id: ModuleId, patch: Partial<ModuleSel>) =>
    setState((s) => ({ ...s, sel: { ...s.sel, modules: { ...s.sel.modules, [id]: { ...s.sel.modules[id], ...patch } } } }));
  const toggleExtra = (id: ModuleId) =>
    setState((s) => ({
      ...s,
      sel: {
        ...s.sel,
        convertWith: s.sel.convertWith.includes(id) ? s.sel.convertWith.filter((x) => x !== id) : [...s.sel.convertWith, id],
      },
    }));
  const extras = AP_MODULES.filter((m) => m.id !== quote.id);
  return (
    <section className="cx-sec" data-testid="pilot-conversion">
      <div className="cx-sec-t">What if Andrew decides to continue?</div>
      <p className="cx-sec-note">
        Optional future implementation, shown separately from the pilot. Nothing here is due now; continuing needs a separate agreement
        approved by Andrew.
      </p>

      <div className="cx-conv">
        <div className="cx-conv-paid">
          <span className="cx-pilot-k">Pilot investment</span>
          <b>{pilotFeeLabel(quote, true)}</b>
          <small>One-time · paid for the pilot only</small>
        </div>
        <div className="cx-conv-future">
          <span className="cx-pilot-k">If Andrew continues — optional, not due now</span>
          <CXRow k={c.modules.length > 1 ? "Standard combined setup" : `Standard ${modName(quote.id)} setup`} v={apFmt(c.setupOrig)} />
          {c.setupPct > 0 && <CXRow k={`Bundle discount (${c.setupPct}%)`} v={apFmt(-(c.setupOrig - c.setupNet))} minus />}
          <CXRow k="Pilot credit (applied once)" v={apFmt(-c.creditApplied)} minus={c.creditApplied > 0} />
          <CXRow k="Remaining setup payment" v={apFmt(c.remainingSetup)} strong />
          <CXRow
            k={c.monthlyPct > 0 ? `Monthly service (${c.monthlyPct}% bundle discount)` : "Monthly service"}
            v={c.monthly == null ? "Custom Quote Required" : `${apFmt(c.monthly)}/mo`}
            strong
          />
          {c.creditAvailable > c.creditApplied && (
            <div className="cx-sum-hint">Credit limited to the setup balance — it never creates a negative amount.</div>
          )}
          <div className="cx-sum-hint">
            Credit valid for {quote.creditDays} days after pilot completion, subject to the contract terms. Setup and monthly service are
            billed separately.
          </div>
        </div>
      </div>

      <div className="cx-conv-extra" role="group" aria-label="Also add later">
        <span className="cx-field-l">Also add later (bundle discount applies; the pilot credit is still used once):</span>
        {extras.map((m) => (
          <label key={m.id} className="cx-check">
            <input type="checkbox" checked={state.sel.convertWith.includes(m.id)} onChange={() => toggleExtra(m.id)} />
            {m.name}
          </label>
        ))}
      </div>

      <div className="cx-mods">
        {c.modules.map((id) => {
          const m = AP_MODULES.find((x) => x.id === id)!;
          return <CXModuleCard key={id} m={m} ms={state.sel.modules[id]} P={P} partner={false} setModule={setModule} conversion />;
        })}
      </div>
    </section>
  );
}

export function PilotSummary({ quote }: { quote: PilotQuote }) {
  return (
    <div className="cx-sum-body">
      <div className="cx-sum-sel">
        <div className="cx-sum-line">
          <span>{quote.info.name}</span>
          <span>{quote.days} days</span>
        </div>
      </div>
      <CXRow k="One-time pilot fee" v={pilotFeeLabel(quote)} strong />
      <CXRow k="Included usage" v={`${quote.usage} ${quote.info.usageUnit}`} />
      {quote.customers != null && <CXRow k="Invited customers" v={`Up to ${quote.customers}`} />}
      <CXRow k="Monthly subscription" v="None" />
      <CXRow k="Implementation credit" v={apFmt(quote.credit)} />
      <div className="cx-total">
        <span>Pilot investment</span>
        <b data-testid="pilot-total">{pilotFeeLabel(quote, true)}</b>
      </div>
      <div className="cx-sum-hint">
        No automatic monthly subscription. Access ends when the pilot expires unless a separate agreement is signed.
      </div>
    </div>
  );
}

export function PilotSettings({ P, setPricing }: { P: Pricing; setPricing: (fn: (p: Pricing) => Pricing) => void }) {
  const set = (id: ModuleId, k: "price" | "days" | "usage" | "credit" | "customers", v: Num) =>
    setPricing((p) => ({ ...p, pilots: { ...p.pilots, [id]: { ...p.pilots[id], [k]: v } } }));
  return (
    <>
      {AP_MODULES.map((m) => (
        <div className="cx-adv-mod" key={m.id}>
          <div className="cx-adv-name">{AP_PILOT_INFO[m.id].name}</div>
          <div className="cx-adv-grid">
            <CXNumber label="Pilot price" prefix="$" value={P.pilots[m.id].price} onChange={(v) => set(m.id, "price", v)} />
            <CXNumber label="Duration" suffix="days" value={P.pilots[m.id].days} onChange={(v) => set(m.id, "days", v)} />
            <CXNumber label={`Usage (${AP_PILOT_INFO[m.id].usageUnit.split(" ").slice(-1)[0]})`} value={P.pilots[m.id].usage} onChange={(v) => set(m.id, "usage", v)} />
            <CXNumber label="Credit" prefix="$" value={P.pilots[m.id].credit} onChange={(v) => set(m.id, "credit", v)} />
            {m.id === "journey" && (
              <CXNumber label="Max invited customers" value={P.pilots.journey.customers ?? ""} onChange={(v) => set("journey", "customers", v)} />
            )}
          </div>
        </div>
      ))}
      <div className="cx-adv-mod">
        <div className="cx-adv-name">Pilot credit window</div>
        <div className="cx-adv-grid">
          <CXNumber
            label="Days after completion"
            suffix="days"
            value={P.pilotCreditDays}
            onChange={(v) => setPricing((p) => ({ ...p, pilotCreditDays: v }))}
          />
        </div>
      </div>
    </>
  );
}
