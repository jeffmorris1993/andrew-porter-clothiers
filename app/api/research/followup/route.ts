import { followup } from "@/lib/research/pipeline";
import { FollowupRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 120;

export const POST = liveRoute({
  route: "research/followup",
  bucket: "research",
  schema: FollowupRequestSchema,
  run: (body, deps) => followup(body.brief, body.aspect, deps),
});
