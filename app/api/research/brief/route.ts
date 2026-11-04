import { buildBrief } from "@/lib/research/pipeline";
import { BriefRequestSchema } from "@/lib/schemas";
import { liveRoute } from "@/lib/server/handler";

export const maxDuration = 180;

export const POST = liveRoute({
  route: "research/brief",
  bucket: "research",
  schema: BriefRequestSchema,
  run: (body, deps) =>
    buildBrief(
      {
        input: body.input,
        candidate: body.candidate,
        identityStatus: body.identityStatus,
        identitySources: body.identitySources,
        shareCustomerDetails: body.shareCustomerDetails,
      },
      deps,
    ),
});
