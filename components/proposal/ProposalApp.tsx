"use client";

/* Port of the bundle's inline app script: hash views + persisted state. */

import { useEffect, useState } from "react";
import { AP_KEY, apComputeQuote, apLoad, type ApState } from "@/lib/proposal/pricing";
import { CalculatorView } from "./CalculatorView";
import { ProposalSheet, ProposalView } from "./ProposalSheet";

function useApState(): [ApState, (fn: (s: ApState) => ApState) => void, boolean] {
  // Start from defaults on the server and first render; load the saved state after mount.
  const [s, setS] = useState<ApState>(() => apLoad(null));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(AP_KEY);
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setS(apLoad(raw));
    setLoaded(true);
    const h = (e: StorageEvent) => {
      if (e.key === AP_KEY) setS(apLoad(e.newValue));
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(AP_KEY, JSON.stringify(s));
    } catch {
      /* storage full or blocked */
    }
  }, [s, loaded]);
  return [s, (fn) => setS(fn), loaded];
}

type View = "proposal" | "configure";
const readHash = (): View => (typeof location !== "undefined" && location.hash === "#proposal" ? "proposal" : "configure");

function useHashView(): [View, (v: View) => void] {
  const [v, setV] = useState<View>("configure");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable in the browser
    setV(readHash());
    const h = () => setV(readHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const go = (next: View) => {
    if (location.hash !== "#" + next) location.hash = next;
    setV(next);
    window.scrollTo(0, 0);
  };
  return [v, go];
}

export function ProposalApp() {
  const [state, setState] = useApState();
  const [view, go] = useHashView();
  const quote = apComputeQuote(state.sel, state.pricing);
  const exportPdf = () => {
    const t = document.title;
    document.title = "Sirrom Studios - Andrew Porter Fine Clothiers - Pricing Proposal";
    window.print();
    setTimeout(() => {
      document.title = t;
    }, 500);
  };
  return (
    <div className="ap-root">
      {view === "proposal" ? (
        <ProposalView quote={quote} pricing={state.pricing} onConfigure={() => go("configure")} onExport={exportPdf} />
      ) : (
        <CalculatorView state={state} setState={setState} quote={quote} onView={() => go("proposal")} onExport={exportPdf} />
      )}
      <div className="print-root">
        <ProposalSheet quote={quote} pricing={state.pricing} />
      </div>
    </div>
  );
}
