import { discover } from "@/lib/research/pipeline";
import { DiscoveryRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";
import { z } from "zod";

export const maxDuration = 180;

export const POST = liveRoute({
  route: "discover",
  bucket: "research",
  schema: z.object({ request: DiscoveryRequestSchema }),
  run: (body, deps) => discover(body.request, deps),
});
