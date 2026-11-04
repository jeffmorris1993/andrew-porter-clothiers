"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultRepository } from "@/lib/store/repository";
import { type JourneyAction, initialJourney, reduce } from "./machine";
import type { ClientJourney } from "./schemas";

/* One simulated journey, shared by the customer view and Andrew's
   workspace. Persisted in this browser only — separate devices would
   need a production backend. Kept apart from the research store so
   "Reset Journey" never touches research data. */

export type Perspective = "customer" | "andrew";

interface JourneyState {
  journey: ClientJourney;
  perspective: Perspective;
  lastRefusal?: string;
  dispatch(a: JourneyAction): boolean;
  setPerspective(p: Perspective): void;
  reset(): void;
}

export const JOURNEY_STORAGE_KEY = "client-journey";

export const useJourney = create<JourneyState>()(
  persist(
    (set, get) => ({
      journey: initialJourney(),
      perspective: "customer",
      dispatch: (a) => {
        const r = reduce(get().journey, a, new Date().toISOString());
        set({ journey: r.journey, lastRefusal: r.refused });
        return !r.refused;
      },
      setPerspective: (perspective) => set({ perspective }),
      reset: () => set({ journey: initialJourney(), perspective: "customer", lastRefusal: undefined }),
    }),
    {
      name: JOURNEY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(defaultRepository),
      // The perspective is per tab, so a presenter can keep the client on one screen and Andrew on another.
      partialize: (s) => ({ journey: s.journey }),
    },
  ),
);

/** Keeps two tabs of the same browser in step (e.g. customer on one screen, Andrew on another). */
export function useCrossTabSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === JOURNEY_STORAGE_KEY) void useJourney.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
