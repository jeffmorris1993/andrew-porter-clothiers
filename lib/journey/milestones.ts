import type { JourneyMilestone } from "./schemas";

/* Illustrative order milestones. Edit this list to match Andrew's actual
   process — the timeline, controls and tests all read from it. */
export const MILESTONE_CONFIG: { id: string; label: string; description: string }[] = [
  { id: "consultation", label: "Consultation completed", description: "We met and talked through what you're looking for." },
  { id: "design", label: "Design and selections reviewed", description: "Cloth, style and details reviewed together." },
  { id: "proposal", label: "Proposal prepared", description: "Andrew has prepared a proposal for your review." },
  { id: "deposit", label: "Deposit recorded", description: "Your deposit has been recorded by the studio." },
  { id: "production", label: "Garment in production", description: "Your garment is being made." },
  { id: "fitting", label: "Fitting or adjustments", description: "Time to try it on and refine the fit." },
  { id: "ready", label: "Ready for pickup", description: "Your garment is ready at the studio." },
  { id: "completed", label: "Completed", description: "Enjoy wearing it — we're here whenever you need us." },
];

export function freshMilestones(): JourneyMilestone[] {
  return MILESTONE_CONFIG.map((m) => ({ ...m, status: "upcoming" as const }));
}

/** Illustrative appointment options. Not connected to any calendar. */
export const SAMPLE_SLOTS = [
  "Thursday · 10:00 am",
  "Thursday · 2:30 pm",
  "Friday · 11:00 am",
  "Saturday · 10:30 am",
  "Saturday · 1:00 pm",
];
