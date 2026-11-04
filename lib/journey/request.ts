import { BUDGETS, COLORS, CONSULT_PREFS, FITS, INTERESTS, STYLE_DIRECTIONS, TIMELINES, WEAR_OCCASIONS } from "./schemas";
import type { ClientJourney, JourneyBriefRequest } from "./schemas";

/** Builds the AI request from the journey. Contact details (email, phone, surname) are never included. */
export function toBriefRequest(j: ClientJourney): JourneyBriefRequest | null {
  const i = j.interest;
  if (!i || !i.aiConsent || !j.andrewConfirmedConsent) return null;
  const s = j.style;
  const a = j.appointment;
  return {
    firstName: i.name.split(/\s+/)[0],
    interests: i.interests.map((k) => (k === "other" && i.interestOther ? `Other: ${i.interestOther}` : INTERESTS[k])),
    occasion: i.occasion,
    timeline: TIMELINES[i.timeline],
    budget: i.budgetRange ? BUDGETS[i.budgetRange] : undefined,
    preferredContact: i.preferredContact,
    style: s
      ? {
          colors: s.colors.map((c) => COLORS[c].label),
          styleDirection: STYLE_DIRECTIONS[s.styleDirection].label,
          wearOccasions: s.wearOccasions.map((w) => WEAR_OCCASIONS[w]),
          fit: FITS[s.fit].label,
          inspiration: s.inspiration,
          consultationPrefs: s.consultationPrefs.map((c) => CONSULT_PREFS[c]),
          notes: s.notes,
        }
      : undefined,
    appointment: a
      ? [a.status, ...a.preferredSlots, a.customRequest, a.confirmedSlot && `confirmed ${a.confirmedSlot}`].filter(Boolean).join("; ")
      : undefined,
    consent: true,
  };
}
