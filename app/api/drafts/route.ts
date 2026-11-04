import { draftEmail } from "@/lib/research/pipeline";
import { DraftRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 60;

export const POST = liveRoute({
  route: "drafts",
  bucket: "assist",
  schema: DraftRequestSchema,
  run: (body, deps) =>
    draftEmail(
      body.brief,
      body.objective,
      body.brief.suggestedActions.find((a) => a.id === body.actionId),
      deps,
    ),
});
