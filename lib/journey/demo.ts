import { postProcessBrief } from "./ai";
import type { AIPreparationBrief, JourneyBriefRequest } from "./schemas";

/* FICTIONAL sample data for the guided demo. "Fill sample answers" uses
   these; Demo Mode's brief is built from the answers by simple rules
   and is labeled as a sample response, not AI. */

export const SAMPLE_CUSTOMER = {
  interest: {
    name: "Graham Whitcombe",
    email: "graham.whitcombe@example.com",
    phone: "",
    preferredContact: "email" as const,
    interests: ["custom-suit", "shirts"] as ("custom-suit" | "shirts")[],
    interestOther: "",
    occasion: "A new role that starts with a board presentation, then everyday client meetings",
    timeline: "1-3-months" as const,
    budgetRange: "3000-6000" as const,
    aiConsent: true,
  },
  style: {
    colors: ["navy", "charcoal", "cream"] as ("navy" | "charcoal" | "cream")[],
    styleDirection: "balanced" as const,
    wearOccasions: ["office", "court", "travel"] as ("office" | "court" | "travel")[],
    fit: "tailored" as const,
    inspiration: "Understated — nothing flashy. I liked the soft shoulders on a jacket I saw in the window.",
    consultationPrefs: ["in-studio", "weekend"] as ("in-studio" | "weekend")[],
    notes: "First time having anything made. I travel a couple of times a month.",
  },
  slots: ["Saturday · 10:30 am", "Friday · 11:00 am"],
};

export function demoBrief(req: JourneyBriefRequest): AIPreparationBrief {
  const s = req.style;
  const prefs = [
    ...req.interests.map((i) => `Interested in: ${i}`),
    ...(s ? [`Style direction: ${s.styleDirection}`, `Fit: ${s.fit}`, s.colors.length ? `Colours: ${s.colors.join(", ")}` : ""] : []),
    ...(s?.inspiration ? [`In their words: “${s.inspiration}”`] : []),
    ...(req.budget ? [`Budget range they chose: ${req.budget}`] : []),
  ].filter(Boolean);
  const unanswered = [
    !s && "Style preferences (questionnaire was skipped)",
    "Whether there is a firm date for the first wear",
    "Past experience with made-to-measure or tailoring",
    s?.wearOccasions.length ? "" : "Where the garments will be worn most",
  ].filter(Boolean) as string[];
  const brief = postProcessBrief(
    {
      summary: `${req.firstName} is interested in ${req.interests.join(" and ").toLowerCase()} for ${req.occasion.toLowerCase()}. They'd like this ${req.timeline.toLowerCase()}${s ? `, prefer a ${s.styleDirection.toLowerCase()} look with a ${s.fit.toLowerCase()} fit` : ""}.`,
      statedPreferences: prefs,
      timingConstraints: [`Timeline chosen: ${req.timeline}`, ...(req.appointment ? [`Consultation: ${req.appointment}`] : [])],
      unansweredQuestions: unanswered,
      consultationQuestions: [
        "What will you wear first, and when?",
        "What has worked — or not — in suits you've owned before?",
        s?.inspiration ? "Can you tell me more about the jacket you mentioned?" : "Is there a look or person whose style you admire?",
        s?.wearOccasions.includes("travel") ? "How do your clothes need to hold up when you travel?" : "How often will you wear this?",
        "Would you like to start with one garment, or plan a few pieces together?",
      ],
      suggestedActions: [
        {
          title: "Confirm the consultation",
          why: "They asked for specific times and the timeline is a few months out.",
          tradeoffs: ["Moves quickly", "Less time to clarify questions first"],
          decisionForAndrew: "Which of their requested times works for you?",
        },
        {
          title: "Ask one clarifying question first",
          why: "The first-wear date isn't stated yet.",
          tradeoffs: ["Better preparation", "Adds a step before meeting"],
          decisionForAndrew: "Is the date important enough to ask before confirming?",
        },
        {
          title: "Send a personal welcome note",
          why: "It's their first custom garment; a warm note sets expectations for the process.",
          tradeoffs: ["Personal touch", "Takes a few minutes to personalise"],
          decisionForAndrew: "Would you like to send this alongside the confirmation?",
        },
      ],
      draftMessage: {
        subject: "Looking forward to meeting you",
        body: `Dear ${req.firstName},\n\nThank you for telling me about ${req.occasion.toLowerCase()}. I'd be delighted to help you put together something that feels right for it.\n\nI've confirmed our consultation for [day and time]. We'll take our time, look at cloth together and talk through how you'd like to wear it — there's nothing you need to prepare.\n\nWarm regards,\nAndrew Porter\nAndrew Porter Fine Clothiers · Carmel`,
      },
    },
    req,
    "demo",
  );
  return { ...brief, systemNotes: ["Sample response — Demo Mode uses simple rules over the customer's answers, not AI.", ...brief.systemNotes], generatedAt: new Date().toISOString() };
}
