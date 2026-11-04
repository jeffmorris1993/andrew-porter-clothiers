import { describe, expect, it } from "vitest";
import { DiscoveryRequestSchema, ProspectInputSchema, SuggestedActionSchema } from "@/lib/schemas";

describe("ProspectInput", () => {
  it("requires a full name", () => {
    expect(ProspectInputSchema.safeParse({ fullName: "" }).success).toBe(false);
    expect(ProspectInputSchema.safeParse({ fullName: " A " }).success).toBe(false);
  });
  it("trims and turns blank optional fields into undefined", () => {
    const r = ProspectInputSchema.parse({ fullName: "  Jane Doe ", company: "   ", notes: "" });
    expect(r.fullName).toBe("Jane Doe");
    expect(r.company).toBeUndefined();
    expect(r.notes).toBeUndefined();
  });
  it("caps long notes", () => {
    expect(ProspectInputSchema.safeParse({ fullName: "Jane Doe", notes: "x".repeat(1501) }).success).toBe(false);
  });
});

describe("DiscoveryRequest", () => {
  it("only allows 5 or 10 results", () => {
    const base = { region: "Indianapolis", roles: ["CEO"] };
    expect(DiscoveryRequestSchema.safeParse({ ...base, resultLimit: 5 }).success).toBe(true);
    expect(DiscoveryRequestSchema.safeParse({ ...base, resultLimit: 10 }).success).toBe(true);
    expect(DiscoveryRequestSchema.safeParse({ ...base, resultLimit: 50 }).success).toBe(false);
  });
  it("requires at least one role and bounds the list", () => {
    expect(DiscoveryRequestSchema.safeParse({ region: "Indy", roles: [], resultLimit: 5 }).success).toBe(false);
    expect(
      DiscoveryRequestSchema.safeParse({ region: "Indy", roles: Array(7).fill("CEO"), resultLimit: 5 }).success,
    ).toBe(false);
  });
});

describe("SuggestedAction", () => {
  it("always requires human approval", () => {
    const a = {
      id: "1", title: "t", description: "d", rationale: "r", supportingFindingIds: [], tradeoffs: [],
      uncertainties: [], missingInformation: [], decisionForAndrew: "x",
    };
    expect(SuggestedActionSchema.safeParse({ ...a, requiresHumanApproval: true }).success).toBe(true);
    expect(SuggestedActionSchema.safeParse({ ...a, requiresHumanApproval: false }).success).toBe(false);
  });
});
