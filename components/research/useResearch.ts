"use client";

import { useCallback } from "react";
import { ClientError, clientFor } from "@/lib/client/api";
import type { ApiError, IdentityCandidate, ProspectInput, ResearchSource } from "@/lib/schemas";
import { useDesk } from "@/lib/store/store";

function asApiError(e: unknown): ApiError {
  if (e instanceof ClientError) return e.info;
  return { code: "client_error", message: e instanceof Error ? e.message : "Something went wrong.", retryable: true };
}

/** Drives the identify → (choose) → brief workflow for the current mode. */
export function useResearch() {
  const mode = useDesk((s) => s.mode);
  const session = useDesk((s) => s.session[s.mode]);
  const setSession = useDesk((s) => s.setSession);
  const patchSession = useDesk((s) => s.patchSession);
  const putBrief = useDesk((s) => s.putBrief);

  const buildBrief = useCallback(
    async (
      m: typeof mode,
      input: ProspectInput,
      share: boolean,
      candidate: IdentityCandidate,
      identityStatus: "single-match" | "selected-by-user",
      identitySources: ResearchSource[],
    ) => {
      patchSession({ phase: "researching", candidateId: candidate.id, error: undefined }, m);
      try {
        const brief = await clientFor(m).brief({
          input,
          candidate,
          identityStatus,
          identitySources,
          shareCustomerDetails: share,
        });
        putBrief(brief);
        patchSession({ phase: "done", briefId: brief.id }, m);
      } catch (e) {
        patchSession({ phase: "error", error: asApiError(e), failedStep: "brief" }, m);
      }
    },
    [patchSession, putBrief],
  );

  const start = useCallback(
    async (input: ProspectInput, shareCustomerDetails: boolean) => {
      const m = mode;
      setSession({ input, shareCustomerDetails, phase: "identifying" }, m);
      try {
        const result = await clientFor(m).identify(input);
        if (result.status === "not-found" || result.candidates.length === 0) {
          patchSession({ phase: "not-found", identify: result }, m);
          return;
        }
        patchSession({ identify: result }, m);
        if (result.status === "single-match") {
          await buildBrief(m, input, shareCustomerDetails, result.candidates[0], "single-match", result.sources);
        } else {
          patchSession({ phase: "choosing" }, m);
        }
      } catch (e) {
        patchSession({ phase: "error", error: asApiError(e), failedStep: "identify" }, m);
      }
    },
    [mode, setSession, patchSession, buildBrief],
  );

  const choose = useCallback(
    (candidate: IdentityCandidate) => {
      const s = useDesk.getState().session[mode];
      if (!s?.identify) return;
      return buildBrief(mode, s.input, s.shareCustomerDetails, candidate, "selected-by-user", s.identify.sources);
    },
    [mode, buildBrief],
  );

  const retry = useCallback(() => {
    const s = useDesk.getState().session[mode];
    if (!s) return;
    if (s.failedStep === "brief" && s.identify && s.candidateId) {
      const c = s.identify.candidates.find((x) => x.id === s.candidateId);
      if (c)
        return buildBrief(
          mode,
          s.input,
          s.shareCustomerDetails,
          c,
          s.identify.status === "ambiguous" ? "selected-by-user" : "single-match",
          s.identify.sources,
        );
    }
    return start(s.input, s.shareCustomerDetails);
  }, [mode, buildBrief, start]);

  const reset = useCallback(() => setSession(undefined, mode), [mode, setSession]);

  return { mode, session, start, choose, retry, reset };
}
