import { generateJourneyBrief } from "@/lib/journey/ai";
import { JourneyBriefRequestSchema } from "@/lib/journey/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 60;

/** Consultation preparation from customer-provided answers. No web search. */
export const POST = liveRoute({
  route: "journey/brief",
  bucket: "assist",
  schema: JourneyBriefRequestSchema,
  run: (body, deps) => generateJourneyBrief(body, deps),
});
