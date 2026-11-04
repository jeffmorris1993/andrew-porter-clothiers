import { z } from "zod";
import { ModeSchema, UsageSchema } from "@/lib/schemas";

/* ─────────────────────────────────────────────────────────────────
   Client Journey — data models.

   Everything here is a SIMULATED workflow with a fictional customer.
   Style preferences are not garment specifications; there are no
   measurement, payment or calendar fields on purpose.
   ───────────────────────────────────────────────────────────────── */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const INTERESTS = {
  "custom-suit": "Custom suit",
  shirts: "Custom shirts",
  "special-occasion": "Special-occasion attire",
  "wardrobe-consultation": "Wardrobe consultation",
  other: "Something else",
} as const;
export const InterestKindSchema = z.enum(Object.keys(INTERESTS) as [keyof typeof INTERESTS, ...(keyof typeof INTERESTS)[]]);
export type InterestKind = z.infer<typeof InterestKindSchema>;

export const TIMELINES = {
  "within-month": "Within a month",
  "1-3-months": "In 1–3 months",
  "3-6-months": "In 3–6 months",
  flexible: "No fixed date",
} as const;
export const TimelineSchema = z.enum(Object.keys(TIMELINES) as [keyof typeof TIMELINES, ...(keyof typeof TIMELINES)[]]);

/** Voluntary. Shown to Andrew exactly as chosen; never used to qualify anyone. */
export const BUDGETS = {
  "under-1500": "Under $1,500",
  "1500-3000": "$1,500 – $3,000",
  "3000-6000": "$3,000 – $6,000",
  "over-6000": "Over $6,000",
  "prefer-not-to-say": "Prefer not to say",
} as const;
export const BudgetSchema = z.enum(Object.keys(BUDGETS) as [keyof typeof BUDGETS, ...(keyof typeof BUDGETS)[]]);

export const CONTACT_METHODS = { email: "Email", phone: "Phone call", text: "Text message" } as const;
export const ContactMethodSchema = z.enum(["email", "phone", "text"]);

export const InterestSubmissionSchema = z
  .object({
    name: z.string().trim().min(2, "Please share your name").max(120),
    email: z.preprocess(blankToUndefined, z.email("That email doesn't look quite right").max(160).optional()),
    phone: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .max(30)
        .regex(/^[+()\d\s.-]{7,}$/, "That phone number doesn't look quite right")
        .optional(),
    ),
    preferredContact: ContactMethodSchema,
    interests: z.array(InterestKindSchema).min(1, "Choose at least one").max(5),
    interestOther: optText(200),
    occasion: z.string().trim().min(2, "Tell us the occasion or purpose").max(240),
    timeline: TimelineSchema,
    budgetRange: BudgetSchema.optional(),
    /** Simulated consent: the customer agrees their answers may be summarized by AI for Andrew. */
    aiConsent: z.boolean(),
  })
  .refine((v) => v.email || v.phone, { message: "Please share an email or phone number", path: ["email"] })
  .refine((v) => v.preferredContact === "email" ? Boolean(v.email) : Boolean(v.phone), {
    message: "Add the contact detail for your preferred method",
    path: ["preferredContact"],
  });
export type InterestSubmission = z.infer<typeof InterestSubmissionSchema> & { submittedAt: string };

export const COLORS = {
  navy: { label: "Navy", hex: "#1f2b45" },
  charcoal: { label: "Charcoal", hex: "#3a3d44" },
  grey: { label: "Mid grey", hex: "#8b8d92" },
  brown: { label: "Brown & tobacco", hex: "#6a4a33" },
  olive: { label: "Olive", hex: "#5d6243" },
  black: { label: "Black", hex: "#16171a" },
  cream: { label: "Cream & stone", hex: "#e8dfcc" },
  burgundy: { label: "Burgundy", hex: "#6e2a32" },
} as const;
export const STYLE_DIRECTIONS = {
  traditional: { label: "Traditional", hint: "Timeless cuts, classic details" },
  balanced: { label: "Balanced", hint: "Classic foundation, modern touches" },
  contemporary: { label: "Contemporary", hint: "Cleaner lines, current details" },
} as const;
export const FITS = {
  classic: { label: "Classic & comfortable", hint: "Room to move" },
  tailored: { label: "Tailored", hint: "Close but easy" },
  slim: { label: "Slim", hint: "Close to the body" },
  unsure: { label: "Not sure yet", hint: "Let's decide together" },
} as const;
export const WEAR_OCCASIONS = {
  office: "Office & client meetings",
  court: "Court or presentations",
  events: "Evening events",
  wedding: "Weddings",
  travel: "Travel",
  weekend: "Weekend & casual",
} as const;
export const CONSULT_PREFS = {
  "in-studio": "At the Carmel studio",
  weekday: "Weekday",
  weekend: "Weekend",
  guest: "Bringing a guest",
} as const;

export const StylePreferencesSchema = z.object({
  colors: z.array(z.enum(Object.keys(COLORS) as [keyof typeof COLORS, ...(keyof typeof COLORS)[]])).max(8),
  styleDirection: z.enum(["traditional", "balanced", "contemporary"]),
  wearOccasions: z.array(z.enum(Object.keys(WEAR_OCCASIONS) as [keyof typeof WEAR_OCCASIONS, ...(keyof typeof WEAR_OCCASIONS)[]])).max(6),
  fit: z.enum(["classic", "tailored", "slim", "unsure"]),
  inspiration: optText(600),
  consultationPrefs: z.array(z.enum(Object.keys(CONSULT_PREFS) as [keyof typeof CONSULT_PREFS, ...(keyof typeof CONSULT_PREFS)[]])).max(4),
  notes: optText(800),
});
export type StylePreferences = z.infer<typeof StylePreferencesSchema> & { savedAt: string };

export const AppointmentStatusSchema = z.enum(["requested", "confirmed", "reschedule-suggested"]);
export interface AppointmentRequest {
  preferredSlots: string[];
  customRequest?: string;
  status: z.infer<typeof AppointmentStatusSchema>;
  confirmedSlot?: string;
  andrewNote?: string;
  requestedAt: string;
  decidedAt?: string;
}

export const ConsultationRequestSchema = z
  .object({
    preferredSlots: z.array(z.string().max(80)).max(3),
    customRequest: optText(240),
  })
  .refine((v) => v.preferredSlots.length > 0 || v.customRequest, {
    message: "Choose a time or describe what works for you",
    path: ["preferredSlots"],
  });

export interface JourneyMilestone {
  id: string;
  label: string;
  description: string;
  status: "upcoming" | "current" | "done";
  updatedAt?: string;
}

export interface MessageDraft {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "shared-in-portal";
  source: "demo-sample" | "live-ai" | "andrew";
  sharedAt?: string;
}

export interface ActivityEvent {
  id: string;
  at: string;
  actor: "customer" | "andrew" | "system";
  text: string;
}

export const BriefActionSchema = z.object({
  title: z.string(),
  why: z.string(),
  tradeoffs: z.array(z.string()),
  decisionForAndrew: z.string(),
});

export const AIPreparationBriefSchema = z.object({
  summary: z.string(),
  statedPreferences: z.array(z.string()),
  timingConstraints: z.array(z.string()),
  unansweredQuestions: z.array(z.string()),
  consultationQuestions: z.array(z.string()),
  suggestedActions: z.array(BriefActionSchema),
  draftMessage: z.object({ subject: z.string(), body: z.string() }),
  systemNotes: z.array(z.string()),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
  generatedAt: z.string(),
});
export type AIPreparationBrief = z.infer<typeof AIPreparationBriefSchema>;

export type JourneyStage = "welcome" | "interest" | "style" | "consultation" | "portal" | "relationship";

export interface PastOrder {
  id: string;
  title: string;
  completedAt: string;
  note: string;
}

export interface ClientJourney {
  id: string;
  stage: JourneyStage;
  interest?: InterestSubmission;
  style?: StylePreferences;
  appointment?: AppointmentRequest;
  /** Andrew's request for more information, shown in the portal until the customer replies. */
  infoRequest?: { note: string; at: string };
  milestones: JourneyMilestone[];
  messages: MessageDraft[];
  preferencesRecorded: { text: string; at: string }[];
  followUps: { text: string; at: string; done: boolean }[];
  pastOrders: PastOrder[];
  futureInterest?: { text: string; at: string };
  andrewConfirmedConsent: boolean;
  brief?: AIPreparationBrief;
  activity: ActivityEvent[];
  viewedByAndrew: boolean;
}

/* ── API contract for the preparation brief ─────────────────────── */

/** Only customer-provided intake fields go to the model. Contact details are stripped. */
export const JourneyBriefRequestSchema = z.object({
  firstName: z.string().max(60),
  interests: z.array(z.string().max(80)).max(6),
  occasion: z.string().max(240),
  timeline: z.string().max(40),
  budget: z.string().max(40).optional(),
  preferredContact: z.string().max(20),
  style: z
    .object({
      colors: z.array(z.string().max(40)).max(8),
      styleDirection: z.string().max(40),
      wearOccasions: z.array(z.string().max(60)).max(6),
      fit: z.string().max(40),
      inspiration: z.string().max(600).optional(),
      consultationPrefs: z.array(z.string().max(40)).max(4),
      notes: z.string().max(800).optional(),
    })
    .optional(),
  appointment: z.string().max(300).optional(),
  consent: z.literal(true, { message: "Customer and Andrew consent are required before AI analysis" }),
});
export type JourneyBriefRequest = z.infer<typeof JourneyBriefRequestSchema>;
