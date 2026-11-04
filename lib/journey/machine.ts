import { freshMilestones } from "./milestones";
import type {
  AIPreparationBrief,
  ActivityEvent,
  ClientJourney,
  InterestSubmission,
  JourneyStage,
  MessageDraft,
  StylePreferences,
} from "./schemas";
import { INTERESTS } from "./schemas";

/* ─────────────────────────────────────────────────────────────────
   Journey state machine — pure and unit tested.

   The customer can only describe and request. Every approval,
   milestone change and message to the customer is an explicit
   Andrew action. Nothing here talks to an external system.
   ───────────────────────────────────────────────────────────────── */

export type JourneyAction =
  // customer
  | { type: "begin" }
  | { type: "submitInterest"; interest: Omit<InterestSubmission, "submittedAt"> }
  | { type: "submitStyle"; style: Omit<StylePreferences, "savedAt"> }
  | { type: "skipStyle" }
  | { type: "requestConsultation"; preferredSlots: string[]; customRequest?: string }
  | { type: "replyToInfoRequest"; text: string }
  | { type: "requestAnotherConsultation" }
  | { type: "expressFutureInterest"; text: string }
  // andrew
  | { type: "markViewed" }
  | { type: "confirmConsent"; value: boolean }
  | { type: "setBrief"; brief: AIPreparationBrief }
  | { type: "approveAppointment"; slot: string }
  | { type: "suggestReschedule"; note: string }
  | { type: "requestMoreInfo"; note: string }
  | { type: "saveDraft"; draft: Omit<MessageDraft, "id" | "status"> }
  | { type: "shareMessage"; id: string; subject: string; body: string }
  | { type: "markConsultationCompleted" }
  | { type: "advanceMilestone" }
  | { type: "stepBackMilestone" }
  | { type: "recordPreference"; text: string }
  | { type: "markFollowUp"; text: string }
  | { type: "completeFollowUp"; index: number };

export interface ReduceResult {
  journey: ClientJourney;
  /** Set when the action was not allowed; the journey is returned unchanged. */
  refused?: string;
}

export function initialJourney(): ClientJourney {
  return {
    id: "journey-demo",
    stage: "welcome",
    milestones: freshMilestones(),
    messages: [],
    preferencesRecorded: [],
    followUps: [],
    pastOrders: [],
    andrewConfirmedConsent: false,
    activity: [],
    viewedByAndrew: false,
  };
}

function log(j: ClientJourney, actor: ActivityEvent["actor"], text: string, now: string): ActivityEvent[] {
  return [{ id: `${now}-${j.activity.length + 1}`, at: now, actor, text }, ...j.activity].slice(0, 200);
}

function refuse(journey: ClientJourney, reason: string): ReduceResult {
  return { journey, refused: reason };
}

export function currentMilestoneIndex(j: ClientJourney): number {
  return j.milestones.findIndex((m) => m.status === "current");
}

export function orderStarted(j: ClientJourney): boolean {
  return j.milestones.some((m) => m.status !== "upcoming");
}

export function orderComplete(j: ClientJourney): boolean {
  return j.milestones.every((m) => m.status === "done");
}

const interestTitle = (j: ClientJourney) =>
  j.interest?.interests.map((i) => INTERESTS[i]).join(" & ") || "Custom garment";

export function reduce(j: ClientJourney, a: JourneyAction, now: string): ReduceResult {
  switch (a.type) {
    case "begin":
      return { journey: { ...j, stage: j.stage === "welcome" ? "interest" : j.stage } };

    case "submitInterest": {
      const interest: InterestSubmission = { ...a.interest, submittedAt: now };
      return {
        journey: {
          ...j,
          interest,
          stage: "style",
          viewedByAndrew: false,
          activity: log(j, "customer", `${interest.name} submitted an interest card (${interestTitle({ ...j, interest })}).`, now),
        },
      };
    }

    case "submitStyle":
    case "skipStyle": {
      if (!j.interest) return refuse(j, "The interest card comes first.");
      const style = a.type === "submitStyle" ? { ...a.style, savedAt: now } : j.style;
      return {
        journey: {
          ...j,
          style,
          stage: "consultation",
          activity: log(j, "customer", a.type === "submitStyle" ? "Shared style preferences." : "Skipped the style questionnaire for now.", now),
        },
      };
    }

    case "requestConsultation": {
      if (!j.interest) return refuse(j, "The interest card comes first.");
      if (a.preferredSlots.length === 0 && !a.customRequest?.trim()) return refuse(j, "Choose a time or describe what works.");
      return {
        journey: {
          ...j,
          stage: "portal",
          appointment: {
            preferredSlots: a.preferredSlots.slice(0, 3),
            customRequest: a.customRequest?.trim() || undefined,
            status: "requested",
            requestedAt: now,
          },
          activity: log(
            j,
            "customer",
            `Requested a consultation (${[...a.preferredSlots, a.customRequest].filter(Boolean).join("; ")}).`,
            now,
          ),
        },
      };
    }

    case "replyToInfoRequest": {
      if (!j.infoRequest) return refuse(j, "There is no open question from Andrew.");
      const text = a.text.trim();
      if (!text) return refuse(j, "Write a reply first.");
      return {
        journey: {
          ...j,
          infoRequest: undefined,
          style: j.style ? { ...j.style, notes: [j.style.notes, text].filter(Boolean).join("\n") } : j.style,
          activity: log(j, "customer", `Replied to Andrew: “${text}”`, now),
        },
      };
    }

    case "requestAnotherConsultation": {
      if (!orderComplete(j)) return refuse(j, "Available once the current order is complete.");
      return {
        journey: {
          ...j,
          stage: "portal",
          milestones: freshMilestones(),
          appointment: { preferredSlots: [], customRequest: "Would like to talk about the next garment", status: "requested", requestedAt: now },
          activity: log(j, "customer", "Requested another consultation.", now),
        },
      };
    }

    case "expressFutureInterest": {
      const text = a.text.trim();
      if (!text) return refuse(j, "Describe what you have in mind.");
      return {
        journey: {
          ...j,
          futureInterest: { text, at: now },
          activity: log(j, "customer", `Noted a future interest: “${text}”`, now),
        },
      };
    }

    case "markViewed":
      return j.viewedByAndrew || !j.interest
        ? { journey: j }
        : { journey: { ...j, viewedByAndrew: true, activity: log(j, "andrew", "Opened the new inquiry.", now) } };

    case "confirmConsent":
      if (a.value && !j.interest?.aiConsent) return refuse(j, "The customer did not agree to AI analysis.");
      return {
        journey: {
          ...j,
          andrewConfirmedConsent: a.value,
          activity: log(j, "andrew", a.value ? "Confirmed AI analysis of the customer's answers." : "Withdrew AI analysis consent.", now),
        },
      };

    case "setBrief":
      return {
        journey: {
          ...j,
          brief: a.brief,
          activity: log(j, "system", `Preparation brief generated (${a.brief.mode === "live" ? "live AI" : "sample"}).`, now),
        },
      };

    case "approveAppointment": {
      if (!j.appointment) return refuse(j, "There is no consultation request to approve.");
      if (j.appointment.status === "confirmed") return refuse(j, "This consultation is already confirmed.");
      if (!a.slot.trim()) return refuse(j, "Choose a time to confirm.");
      return {
        journey: {
          ...j,
          appointment: { ...j.appointment, status: "confirmed", confirmedSlot: a.slot, decidedAt: now },
          activity: log(j, "andrew", `Confirmed the consultation for ${a.slot} (sample appointment).`, now),
        },
      };
    }

    case "suggestReschedule": {
      if (!j.appointment) return refuse(j, "There is no consultation request.");
      return {
        journey: {
          ...j,
          appointment: { ...j.appointment, status: "reschedule-suggested", andrewNote: a.note.trim(), decidedAt: now },
          activity: log(j, "andrew", `Suggested another time: “${a.note.trim()}”`, now),
        },
      };
    }

    case "requestMoreInfo": {
      const note = a.note.trim();
      if (!note) return refuse(j, "Write the question first.");
      return {
        journey: { ...j, infoRequest: { note, at: now }, activity: log(j, "andrew", `Asked the customer: “${note}”`, now) },
      };
    }

    case "saveDraft": {
      const draft: MessageDraft = { ...a.draft, id: `msg-${now}-${j.messages.length + 1}`, status: "draft" };
      return { journey: { ...j, messages: [draft, ...j.messages] } };
    }

    case "shareMessage": {
      const m = j.messages.find((x) => x.id === a.id);
      if (!m) return refuse(j, "Draft not found.");
      if (!a.body.trim()) return refuse(j, "The message is empty.");
      return {
        journey: {
          ...j,
          messages: j.messages.map((x) =>
            x.id === a.id ? { ...x, subject: a.subject, body: a.body, status: "shared-in-portal", sharedAt: now } : x,
          ),
          activity: log(j, "andrew", `Shared a message in the client portal: “${a.subject}”.`, now),
        },
      };
    }

    case "markConsultationCompleted": {
      if (j.appointment?.status !== "confirmed") return refuse(j, "Confirm the consultation before marking it completed.");
      if (orderStarted(j)) return refuse(j, "The consultation is already marked completed.");
      const milestones = j.milestones.map((m, i) =>
        i === 0 ? { ...m, status: "done" as const, updatedAt: now } : i === 1 ? { ...m, status: "current" as const, updatedAt: now } : m,
      );
      return {
        journey: { ...j, milestones, activity: log(j, "andrew", "Marked the consultation completed.", now) },
      };
    }

    case "advanceMilestone": {
      const i = currentMilestoneIndex(j);
      if (i < 0) return refuse(j, orderComplete(j) ? "The order is already complete." : "Mark the consultation completed first.");
      const last = i === j.milestones.length - 1;
      const milestones = j.milestones.map((m, k) =>
        k === i ? { ...m, status: "done" as const, updatedAt: now } : k === i + 1 ? { ...m, status: "current" as const, updatedAt: now } : m,
      );
      let next: ClientJourney = {
        ...j,
        milestones,
        activity: log(j, "andrew", `Updated the order: “${j.milestones[i].label}” done${last ? "" : `, now “${j.milestones[i + 1].label}”`}.`, now),
      };
      if (last) {
        next = {
          ...next,
          stage: "relationship" as JourneyStage,
          pastOrders: [
            { id: `order-${now}`, title: interestTitle(j), completedAt: now, note: j.interest?.occasion ?? "" },
            ...j.pastOrders,
          ],
        };
      }
      return { journey: next };
    }

    case "stepBackMilestone": {
      const i = currentMilestoneIndex(j);
      if (i <= 0) return refuse(j, "Nothing to step back.");
      const milestones = j.milestones.map((m, k) =>
        k === i ? { ...m, status: "upcoming" as const, updatedAt: now } : k === i - 1 ? { ...m, status: "current" as const, updatedAt: now } : m,
      );
      return {
        journey: { ...j, milestones, activity: log(j, "andrew", `Corrected the order status back to “${j.milestones[i - 1].label}”.`, now) },
      };
    }

    case "recordPreference": {
      const text = a.text.trim();
      if (!text) return refuse(j, "Write the preference first.");
      return {
        journey: {
          ...j,
          preferencesRecorded: [{ text, at: now }, ...j.preferencesRecorded],
          activity: log(j, "andrew", `Recorded a preference: “${text}”`, now),
        },
      };
    }

    case "markFollowUp": {
      const text = a.text.trim();
      if (!text) return refuse(j, "Describe the follow-up first.");
      return {
        journey: {
          ...j,
          followUps: [{ text, at: now, done: false }, ...j.followUps],
          activity: log(j, "andrew", `Marked for follow-up: “${text}”`, now),
        },
      };
    }

    case "completeFollowUp":
      return {
        journey: { ...j, followUps: j.followUps.map((f, i) => (i === a.index ? { ...f, done: true } : f)) },
      };
  }
}

/* ── Customer-facing selectors ─────────────────────────────────── */

export function customerStageLabel(j: ClientJourney): string {
  if (j.stage === "relationship") return "A valued client";
  if (orderStarted(j)) return j.milestones[currentMilestoneIndex(j)]?.label ?? "Your order";
  if (j.appointment?.status === "confirmed") return "Consultation confirmed";
  if (j.appointment?.status === "reschedule-suggested") return "Andrew suggested another time";
  if (j.appointment) return "Consultation requested";
  if (j.interest) return "Getting to know you";
  return "Welcome";
}

export function customerNextAction(j: ClientJourney): string {
  if (j.infoRequest) return "Andrew has a question for you — reply below.";
  if (j.stage === "relationship") return "Whenever you're ready, request a consultation for your next garment.";
  if (orderStarted(j)) return "Nothing needed from you right now. Andrew will update you at each step.";
  if (j.appointment?.status === "confirmed") return `We look forward to seeing you ${j.appointment.confirmedSlot}.`;
  if (j.appointment?.status === "reschedule-suggested") return "Review Andrew's suggested time below.";
  if (j.appointment) return "Andrew will personally confirm your consultation time.";
  return "Complete your interest card to begin.";
}

export function guidedStep(j: ClientJourney): number {
  // Matches the 11-step demo story.
  if (j.stage === "relationship") return 11;
  if (orderStarted(j)) return 10;
  if (j.appointment?.status === "confirmed") return j.messages.some((m) => m.status === "shared-in-portal") ? 9 : 8;
  if (j.brief) return 8;
  if (j.viewedByAndrew) return 7;
  if (j.appointment) return 5;
  if (j.stage === "consultation") return 4;
  if (j.stage === "style") return 3;
  if (j.stage === "interest") return 2;
  return 1;
}
