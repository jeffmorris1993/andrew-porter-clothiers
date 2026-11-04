import { identify } from "@/lib/research/pipeline";
import { IdentifyRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 120;

export const POST = liveRoute({
  route: "research/identify",
  bucket: "research",
  schema: IdentifyRequestSchema,
  run: (body, deps) => identify(body.input, deps),
});
