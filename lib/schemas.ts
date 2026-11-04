import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────
   Shared data contracts.

   Four kinds of information are kept apart on purpose:
   - findings        → public claims linked to real web-search sources
   - customerProvided → what the prospect told Andrew (never "verified")
   - interpretation  → AI-written summary, insights and options
   - uncertainty     → gaps, conflicts and notes on what is not known
   ───────────────────────────────────────────────────────────────── */

const text = (max: number) => z.string().trim().max(max);
/** Optional free text; blank strings become undefined. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const ModeSchema = z.enum(["demo", "live"]);
export type Mode = z.infer<typeof ModeSchema>;

/* ── Input ──────────────────────────────────────────────────────── */

export const ProspectInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the prospect's full name").max(120),
  company: optionalText(160),
  region: optionalText(120),
  clothingInterest: optionalText(240),
  statedBudget: optionalText(80),
  notes: optionalText(1500),
});
export type ProspectInput = z.infer<typeof ProspectInputSchema>;

/** Customer-provided details. Shown to Andrew as-is; sent to the AI only with his consent. */
export const CustomerProvidedSchema = z.object({
  clothingInterest: z.string().optional(),
  statedBudget: z.string().optional(),
  notes: z.string().optional(),
  sharedWithAI: z.boolean(),
});
export type CustomerProvided = z.infer<typeof CustomerProvidedSchema>;

/* ── Sources & findings ─────────────────────────────────────────── */

export const ResearchSourceSchema = z.object({
  id: z.string(),
  url: z.url(),
  title: z.string(),
  publisher: z.string().optional(),
  retrievedAt: z.string(),
  publishedAt: z.string().optional(),
  /** true when the model cited it inline; false when it was only consulted by the search tool */
  cited: z.boolean(),
  /** true for fictional Demo Mode sources */
  sample: z.boolean().optional(),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const VerificationStatusSchema = z.enum([
  "corroborated", // linked to ≥2 sources on different domains
  "single-source", // linked to exactly one source domain
  "conflicting", // sources disagree
  "unverified", // no valid source link
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const FindingCategorySchema = z.enum([
  "role",
  "organization",
  "career",
  "affiliation",
  "accomplishment",
  "company",
  "other",
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const ResearchFindingSchema = z.object({
  id: z.string(),
  claim: z.string(),
  category: FindingCategorySchema,
  sourceIds: z.array(z.string()),
  verificationStatus: VerificationStatusSchema,
  uncertaintyNote: z.string().optional(),
});
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;

/* ── Identity ───────────────────────────────────────────────────── */

export const IdentityCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  organization: z.string().optional(),
  region: z.string().optional(),
  distinguishingDetails: z.array(z.string()),
  sourceIds: z.array(z.string()),
});
export type IdentityCandidate = z.infer<typeof IdentityCandidateSchema>;

export const IdentityStatusSchema = z.enum([
  "single-match", // one plausible person found
  "selected-by-user", // Andrew chose among several
  "ambiguous", // several plausible people; awaiting Andrew
  "not-found", // no credible public match
]);
export type IdentityStatus = z.infer<typeof IdentityStatusSchema>;

export const UsageSchema = z.object({
  model: z.string(),
  calls: z.number(),
  webSearchCalls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  totalTokens: z.number(),
  durationMs: z.number(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const IdentifyResultSchema = z.object({
  status: IdentityStatusSchema,
  candidates: z.array(IdentityCandidateSchema),
  sources: z.array(ResearchSourceSchema),
  note: z.string().optional(),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
});
export type IdentifyResult = z.infer<typeof IdentifyResultSchema>;

/* ── Brief ──────────────────────────────────────────────────────── */

export const SuggestedActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  supportingFindingIds: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  uncertainties: z.array(z.string()),
  missingInformation: z.array(z.string()),
  decisionForAndrew: z.string(),
  requiresHumanApproval: z.literal(true),
});
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const ProfessionalProfileSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  organization: z.string().optional(),
  location: z.string().optional(),
  /** AI interpretation of the findings — not itself a verified fact */
  summary: z.string(),
});
export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

export const ProspectBriefSchema = z.object({
  id: z.string(),
  input: ProspectInputSchema,
  customerProvided: CustomerProvidedSchema,
  identityStatus: IdentityStatusSchema,
  identity: IdentityCandidateSchema.optional(),
  professionalProfile: ProfessionalProfileSchema,
  findings: z.array(ResearchFindingSchema),
  sources: z.array(ResearchSourceSchema),
  sourceIds: z.array(z.string()),
  missingInformation: z.array(z.string()),
  preparationInsights: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
  suggestedActions: z.array(SuggestedActionSchema),
  /** System notes, e.g. sources that were excluded by policy */
  systemNotes: z.array(z.string()),
  researchedAt: z.string(),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
});
export type ProspectBrief = z.infer<typeof ProspectBriefSchema>;

/* ── Discovery ──────────────────────────────────────────────────── */

export const DiscoveryRequestSchema = z.object({
  region: z.string().trim().min(2, "Enter a city or metro area").max(120),
  roles: z.array(text(80).min(2)).min(1, "Choose at least one role").max(6),
  industry: optionalText(120),
  resultLimit: z.union([z.literal(5), z.literal(10)]),
});
export type DiscoveryRequest = z.infer<typeof DiscoveryRequestSchema>;

export const ConfidenceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  reason: z.string(),
});

export const DiscoveryEvidenceSchema = z.object({
  claim: z.string(),
  sourceIds: z.array(z.string()),
  verificationStatus: VerificationStatusSchema,
});

export const DiscoveryResultSchema = z.object({
  id: z.string(),
  person: z.string(),
  professionalRole: z.string(),
  organization: z.string(),
  region: z.string().optional(),
  evidence: z.array(DiscoveryEvidenceSchema),
  sources: z.array(ResearchSourceSchema),
  researchGaps: z.array(z.string()),
  identityConfidence: ConfidenceSchema,
  relevanceExplanation: z.string(),
  mode: ModeSchema,
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

export const DiscoveryResponseSchema = z.object({
  request: DiscoveryRequestSchema,
  results: z.array(DiscoveryResultSchema),
  note: z.string().optional(),
  systemNotes: z.array(z.string()),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

/* ── Requests to the API ────────────────────────────────────────── */

export const IdentifyRequestSchema = z.object({
  input: ProspectInputSchema,
});

export const BriefRequestSchema = z.object({
  input: ProspectInputSchema,
  shareCustomerDetails: z.boolean().default(false),
  candidate: IdentityCandidateSchema,
  identityStatus: z.enum(["single-match", "selected-by-user"]),
  /** Sources from the identification step, so candidate source ids stay valid.
      The browser sends only the candidate's own; the cap is generous for older open tabs. */
  identitySources: z.array(ResearchSourceSchema).max(100),
});

export const FollowupRequestSchema = z.object({
  brief: ProspectBriefSchema,
  aspect: z.string().trim().min(3).max(240),
});

export const FollowupResultSchema = z.object({
  aspect: z.string(),
  findings: z.array(ResearchFindingSchema),
  sources: z.array(ResearchSourceSchema),
  missingInformation: z.array(z.string()),
  summary: z.string(),
  systemNotes: z.array(z.string()),
  usage: UsageSchema.optional(),
});
export type FollowupResult = z.infer<typeof FollowupResultSchema>;

/** A compact research context for the assistant: briefs and/or discovery profiles. */
export const AssistContextSchema = z.object({
  briefs: z.array(ProspectBriefSchema).max(3),
  discoveries: z.array(DiscoveryResultSchema).max(3),
});
export type AssistContext = z.infer<typeof AssistContextSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AssistRequestSchema = z.object({
  question: z.string().trim().min(2).max(600),
  context: AssistContextSchema,
  history: z.array(ChatMessageSchema).max(10),
});

export const AssistResponseSchema = z.object({
  answer: z.string(),
  answerableFromContext: z.boolean(),
  referencedFindingIds: z.array(z.string()),
  suggestedSearch: z.string().optional(),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
});
export type AssistResponse = z.infer<typeof AssistResponseSchema>;

export const DraftRequestSchema = z.object({
  brief: ProspectBriefSchema,
  objective: z.enum(["invite-consultation", "request-information", "follow-up"]),
  actionId: z.string().optional(),
});

export const DraftResponseSchema = z.object({
  subject: z.string(),
  body: z.string(),
  basedOnFindingIds: z.array(z.string()),
  reviewNotes: z.array(z.string()),
  mode: ModeSchema,
  usage: UsageSchema.optional(),
});
export type DraftResponse = z.infer<typeof DraftResponseSchema>;

/* ── Errors ─────────────────────────────────────────────────────── */

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>["error"];
