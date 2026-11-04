import { assist } from "@/lib/research/pipeline";
import { AssistRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 60;

export const POST = liveRoute({
  route: "assist",
  bucket: "assist",
  schema: AssistRequestSchema,
  run: (body, deps) => assist(body.question, body.context, body.history, deps),
});
