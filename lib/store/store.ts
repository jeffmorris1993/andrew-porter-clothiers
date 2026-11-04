"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mergeFollowup } from "@/lib/research/context";
import { PEOPLE, buildDemoBrief, DEMO_SCENARIOS, demoDiscoveryResults } from "@/lib/demo/fixtures";
import {
  type DecisionRecord,
  type SavedItem,
  type SavedKind,
  pruneCompare,
  recordDecision,
  setSavedStatus,
  toggleCompare,
  upsertSaved,
} from "@/lib/decisions";
import type {
  ApiError,
  DiscoveryResponse,
  DiscoveryResult,
  FollowupResult,
  IdentifyResult,
  Mode,
  ProspectBrief,
  ProspectInput,
} from "@/lib/schemas";
import { defaultRepository } from "./repository";

export type ResearchPhase = "idle" | "identifying" | "choosing" | "researching" | "done" | "error" | "not-found";

export interface ResearchSession {
  input: ProspectInput;
  shareCustomerDetails: boolean;
  phase: ResearchPhase;
  identify?: IdentifyResult;
  briefId?: string;
  error?: ApiError;
  /** which step failed, so retry resumes there */
  failedStep?: "identify" | "brief";
  candidateId?: string;
}

export interface DraftState {
  subject: string;
  body: string;
  reviewNotes: string[];
  basedOnFindingIds: string[];
  objective: "invite-consultation" | "request-information" | "follow-up";
  mode: Mode;
  generatedAt: string;
  edited: boolean;
}

interface DeskState {
  mode: Mode;
  briefs: Record<string, ProspectBrief>;
  discoveries: Record<string, DiscoveryResult>;
  lastDiscovery: Partial<Record<Mode, DiscoveryResponse>>;
  saved: SavedItem[];
  compare: Record<Mode, string[]>;
  decisions: DecisionRecord[];
  drafts: Record<string, DraftState>;
  crmNotes: Record<string, string>;
  session: Partial<Record<Mode, ResearchSession>>;
  pendingResearch?: { input: ProspectInput; mode: Mode };
  demoSeeded: boolean;
  focusSavedId?: string;

  setMode(m: Mode): void;
  setSession(s: ResearchSession | undefined, mode?: Mode): void;
  patchSession(p: Partial<ResearchSession>, mode?: Mode): void;
  putBrief(b: ProspectBrief): void;
  applyFollowup(briefId: string, f: FollowupResult): void;
  putDiscovery(r: DiscoveryResponse): void;
  save(kind: SavedKind, refId: string): string;
  setStatus(savedId: string, status: SavedItem["status"]): void;
  toggleCompare(savedId: string): boolean;
  setFocus(savedId?: string): void;
  decide(rec: Omit<DecisionRecord, "id" | "at" | "mode">): void;
  setDraft(briefId: string, d: DraftState | undefined): void;
  setCrmNote(briefId: string, text: string | undefined): void;
  queueResearch(input: ProspectInput): void;
  clearPending(): void;
  seedDemo(): void;
  resetMode(): void;
}

const now = () => new Date().toISOString();

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      mode: "demo",
      briefs: {},
      discoveries: {},
      lastDiscovery: {},
      saved: [],
      compare: { demo: [], live: [] },
      decisions: [],
      drafts: {},
      crmNotes: {},
      session: {},
      demoSeeded: false,

      setMode: (mode) => {
        set({ mode });
        if (mode === "demo") get().seedDemo();
      },
      // `mode` pins a write to the mode a request started in, so a slow live
      // response can never land in the demo session (or vice versa).
      setSession: (s, mode) => set((st) => ({ session: { ...st.session, [mode ?? st.mode]: s } })),
      patchSession: (p, mode) =>
        set((st) => {
          const m = mode ?? st.mode;
          const cur = st.session[m];
          if (!cur) return {};
          return { session: { ...st.session, [m]: { ...cur, ...p } } };
        }),
      putBrief: (b) => set((st) => ({ briefs: { ...st.briefs, [b.id]: b } })),
      applyFollowup: (briefId, f) =>
        set((st) => {
          const b = st.briefs[briefId];
          return b ? { briefs: { ...st.briefs, [briefId]: mergeFollowup(b, f) } } : {};
        }),
      putDiscovery: (r) =>
        set((st) => {
          const discoveries = { ...st.discoveries };
          for (const d of r.results) discoveries[d.id] = d;
          return { discoveries, lastDiscovery: { ...st.lastDiscovery, [r.mode]: r } };
        }),
      save: (kind, refId) => {
        const mode = kind === "brief" ? get().briefs[refId]?.mode : get().discoveries[refId]?.mode;
        set((st) => ({ saved: upsertSaved(st.saved, { kind, refId, mode: mode ?? st.mode }, now()) }));
        return `${kind}:${refId}`;
      },
      setStatus: (savedId, status) =>
        set((st) => {
          const saved = setSavedStatus(st.saved, savedId, status);
          return {
            saved,
            compare: { demo: pruneCompare(st.compare.demo, saved), live: pruneCompare(st.compare.live, saved) },
          };
        }),
      toggleCompare: (savedId) => {
        const st = get();
        const r = toggleCompare(st.compare[st.mode], savedId);
        set({ compare: { ...st.compare, [st.mode]: r.ids } });
        return !r.refused;
      },
      setFocus: (focusSavedId) => set({ focusSavedId }),
      decide: (rec) => set((st) => ({ decisions: recordDecision(st.decisions, { ...rec, mode: st.mode }, now()) })),
      setDraft: (briefId, d) =>
        set((st) => {
          const drafts = { ...st.drafts };
          if (d) drafts[briefId] = d;
          else delete drafts[briefId];
          return { drafts };
        }),
      setCrmNote: (briefId, text) =>
        set((st) => {
          const crmNotes = { ...st.crmNotes };
          if (text === undefined) delete crmNotes[briefId];
          else crmNotes[briefId] = text;
          return { crmNotes };
        }),
      queueResearch: (input) => set((st) => ({ pendingResearch: { input, mode: st.mode } })),
      clearPending: () => set({ pendingResearch: undefined }),

      seedDemo: () => {
        if (get().demoSeeded) return;
        const scenario = DEMO_SCENARIOS[0];
        const ellery = buildDemoBrief(PEOPLE.ellery, scenario.input, "single-match");
        const teller = buildDemoBrief(PEOPLE.teller, DEMO_SCENARIOS[2].input, "single-match");
        const disc = demoDiscoveryResults();
        const marsh = disc.find((d) => d.person === "Helen Marsh")!;
        set((st) => {
          let saved = st.saved;
          const t = now();
          saved = upsertSaved(saved, { kind: "discovery", refId: marsh.id, mode: "demo" }, t);
          saved = upsertSaved(saved, { kind: "brief", refId: teller.id, mode: "demo" }, t);
          saved = upsertSaved(saved, { kind: "brief", refId: ellery.id, mode: "demo" }, t);
          return {
            demoSeeded: true,
            briefs: { ...st.briefs, [ellery.id]: ellery, [teller.id]: teller },
            discoveries: { ...st.discoveries, [marsh.id]: marsh },
            saved,
            compare: { ...st.compare, demo: [`brief:${ellery.id}`, `brief:${teller.id}`] },
          };
        });
      },

      resetMode: () =>
        set((st) => {
          const m = st.mode;
          const keepBriefs = Object.fromEntries(Object.entries(st.briefs).filter(([, b]) => b.mode !== m));
          const keepDisc = Object.fromEntries(Object.entries(st.discoveries).filter(([, d]) => d.mode !== m));
          return {
            briefs: keepBriefs,
            discoveries: keepDisc,
            saved: st.saved.filter((s) => s.mode !== m),
            compare: { ...st.compare, [m]: [] },
            decisions: st.decisions.filter((d) => d.mode !== m),
            drafts: Object.fromEntries(Object.entries(st.drafts).filter(([id]) => keepBriefs[id])),
            crmNotes: Object.fromEntries(Object.entries(st.crmNotes).filter(([id]) => keepBriefs[id])),
            session: { ...st.session, [m]: undefined },
            lastDiscovery: { ...st.lastDiscovery, [m]: undefined },
            demoSeeded: m === "demo" ? false : st.demoSeeded,
          };
        }),
    }),
    {
      name: "client-intelligence-desk",
      version: 1,
      storage: createJSONStorage(defaultRepository),
      partialize: (s) => {
        // Don't persist a request that was in flight; it can't resume after reload.
        const session = Object.fromEntries(
          Object.entries(s.session).map(([m, v]) => [
            m,
            v && (v.phase === "identifying" || v.phase === "researching") ? { ...v, phase: "idle" as const } : v,
          ]),
        );
        const { pendingResearch: _p, focusSavedId: _f, ...rest } = s;
        void _p;
        void _f;
        return { ...rest, session };
      },
    },
  ),
);
