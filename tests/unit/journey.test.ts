import { describe, expect, it } from "vitest";
import { postProcessBrief } from "@/lib/journey/ai";
import { SAMPLE_CUSTOMER, demoBrief } from "@/lib/journey/demo";
import {
  type JourneyAction,
  currentMilestoneIndex,
  customerNextAction,
  customerStageLabel,
  guidedStep,
  initialJourney,
  orderComplete,
  reduce,
} from "@/lib/journey/machine";
import { MILESTONE_CONFIG } from "@/lib/journey/milestones";
import { toBriefRequest } from "@/lib/journey/request";
import { AIPreparationBriefSchema, InterestSubmissionSchema, StylePreferencesSchema, type ClientJourney } from "@/lib/journey/schemas";

const T = "2026-11-04T12:00:00.000Z";
function run(actions: JourneyAction[], start: ClientJourney = initialJourney()) {
  let j = start;
  const refusals: (string | undefined)[] = [];
  for (const a of actions) {
    const r = reduce(j, a, T);
    j = r.journey;
    refusals.push(r.refused);
  }
  return { j, refusals };
}
const interest = InterestSubmissionSchema.parse(SAMPLE_CUSTOMER.interest);
const style = StylePreferencesSchema.parse(SAMPLE_CUSTOMER.style);
const intake: JourneyAction[] = [
  { type: "begin" },
  { type: "submitInterest", interest },
  { type: "submitStyle", style },
  { type: "requestConsultation", preferredSlots: SAMPLE_CUSTOMER.slots },
];

describe("customer intake validation", () => {
  const base = { ...SAMPLE_CUSTOMER.interest };
  it("accepts the sample card", () => expect(InterestSubmissionSchema.safeParse(base).success).toBe(true));
  it("requires a name, an interest and an occasion", () => {
    expect(InterestSubmissionSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(InterestSubmissionSchema.safeParse({ ...base, interests: [] }).success).toBe(false);
    expect(InterestSubmissionSchema.safeParse({ ...base, occasion: "" }).success).toBe(false);
  });
  it("needs a way to reach the customer that matches their preference", () => {
    expect(InterestSubmissionSchema.safeParse({ ...base, email: "", phone: "" }).success).toBe(false);
    expect(InterestSubmissionSchema.safeParse({ ...base, preferredContact: "text", phone: "" }).success).toBe(false);
    expect(InterestSubmissionSchema.safeParse({ ...base, preferredContact: "text", phone: "317-555-0100" }).success).toBe(true);
    expect(InterestSubmissionSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });
  it("budget is optional", () => expect(InterestSubmissionSchema.safeParse({ ...base, budgetRange: undefined }).success).toBe(true));
  it("style preferences have no measurement fields", () => {
    expect(Object.keys(StylePreferencesSchema.shape)).not.toEqual(expect.arrayContaining(["chest", "waist", "inseam", "measurements"]));
    const parsed = StylePreferencesSchema.parse({ ...SAMPLE_CUSTOMER.style, chest: 42 } as never);
    expect("chest" in parsed).toBe(false);
  });
});

describe("journey transitions", () => {
  it("moves the customer through intake into the portal with a pending request", () => {
    const { j } = run(intake);
    expect(j.stage).toBe("portal");
    expect(j.appointment).toMatchObject({ status: "requested", preferredSlots: SAMPLE_CUSTOMER.slots });
    expect(customerStageLabel(j)).toBe("Consultation requested");
    expect(customerNextAction(j)).toMatch(/Andrew will personally confirm/);
    expect(j.activity.filter((a) => a.actor === "customer")).toHaveLength(3);
  });

  it("refuses steps out of order", () => {
    const { refusals } = run([{ type: "submitStyle", style }, { type: "requestConsultation", preferredSlots: ["x"] }]);
    expect(refusals.every(Boolean)).toBe(true);
  });

  it("approval is Andrew's action and is reflected in the customer portal", () => {
    const { j } = run([...intake, { type: "approveAppointment", slot: "Saturday · 10:30 am" }]);
    expect(j.appointment).toMatchObject({ status: "confirmed", confirmedSlot: "Saturday · 10:30 am" });
    expect(customerStageLabel(j)).toBe("Consultation confirmed");
    expect(customerNextAction(j)).toContain("Saturday · 10:30 am");
    expect(j.activity[0]).toMatchObject({ actor: "andrew" });
    expect(reduce(j, { type: "approveAppointment", slot: "Friday" }, T).refused).toMatch(/already confirmed/);
  });

  it("can't complete the consultation or advance milestones before approval", () => {
    const { j, refusals } = run([...intake, { type: "markConsultationCompleted" }, { type: "advanceMilestone" }]);
    expect(refusals.slice(-2).every(Boolean)).toBe(true);
    expect(currentMilestoneIndex(j)).toBe(-1);
  });

  it("advances milestones one explicit step at a time, and can be corrected", () => {
    let { j } = run([...intake, { type: "approveAppointment", slot: "Sat" }, { type: "markConsultationCompleted" }]);
    expect(j.milestones[0].status).toBe("done");
    expect(j.milestones[1].status).toBe("current");
    j = reduce(j, { type: "advanceMilestone" }, T).journey;
    expect(customerStageLabel(j)).toBe(MILESTONE_CONFIG[2].label);
    j = reduce(j, { type: "stepBackMilestone" }, T).journey;
    expect(customerStageLabel(j)).toBe(MILESTONE_CONFIG[1].label);
  });

  it("completing the last milestone opens the continuing relationship", () => {
    const steps: JourneyAction[] = [...intake, { type: "approveAppointment", slot: "Sat" }, { type: "markConsultationCompleted" }];
    for (let i = 1; i < MILESTONE_CONFIG.length; i++) steps.push({ type: "advanceMilestone" });
    const { j } = run(steps);
    expect(orderComplete(j)).toBe(true);
    expect(j.stage).toBe("relationship");
    expect(j.pastOrders).toHaveLength(1);
    expect(guidedStep(j)).toBe(11);
    expect(reduce(j, { type: "advanceMilestone" }, T).refused).toBeTruthy();
    const again = reduce(j, { type: "requestAnotherConsultation" }, T).journey;
    expect(again.appointment?.status).toBe("requested");
    expect(again.milestones.every((m) => m.status === "upcoming")).toBe(true);
    expect(again.pastOrders).toHaveLength(1);
  });

  it("messages reach the portal only when Andrew shares them", () => {
    let { j } = run([...intake, { type: "saveDraft", draft: { subject: "Hello", body: "Dear Graham", source: "andrew" } }]);
    expect(j.messages[0].status).toBe("draft");
    j = reduce(j, { type: "shareMessage", id: j.messages[0].id, subject: "Hello", body: "Dear Graham, edited" }, T).journey;
    expect(j.messages[0]).toMatchObject({ status: "shared-in-portal", body: "Dear Graham, edited" });
  });

  it("andrew's question appears for the customer and their reply is kept", () => {
    let { j } = run([...intake, { type: "requestMoreInfo", note: "Is there a date?" }]);
    expect(customerNextAction(j)).toMatch(/question/);
    j = reduce(j, { type: "replyToInfoRequest", text: "March 3rd" }, T).journey;
    expect(j.infoRequest).toBeUndefined();
    expect(j.style?.notes).toContain("March 3rd");
  });

  it("AI consent needs the customer's agreement first", () => {
    const noConsent = run([{ type: "begin" }, { type: "submitInterest", interest: { ...interest, aiConsent: false } }]).j;
    expect(reduce(noConsent, { type: "confirmConsent", value: true }, T).refused).toMatch(/did not agree/);
    expect(toBriefRequest(noConsent)).toBeNull();
  });

  it("reset returns a pristine journey", () => {
    const { j } = run([...intake, { type: "approveAppointment", slot: "Sat" }]);
    expect(j).not.toEqual(initialJourney());
    expect(initialJourney()).toMatchObject({ stage: "welcome", activity: [], messages: [] });
    expect(initialJourney().interest).toBeUndefined();
  });
});

describe("AI request and response handling", () => {
  const consented = run([...intake, { type: "confirmConsent", value: true }]).j;

  it("only sends customer-provided answers, never contact details", () => {
    const req = toBriefRequest(consented)!;
    const text = JSON.stringify(req);
    expect(req.firstName).toBe("Graham");
    expect(text).not.toContain("Whitcombe");
    expect(text).not.toContain("@example.com");
    expect(req.budget).toBe("$3,000 – $6,000");
  });

  it("strips invented prices, measurements and availability, keeps the customer's own budget", () => {
    const req = toBriefRequest(consented)!;
    const out = postProcessBrief(
      {
        summary: "Graham wants a suit; budget $3,000 – $6,000.",
        statedPreferences: ["Navy", "Budget: $3,000 – $6,000", "Chest 42 inches"],
        timingConstraints: ["Board presentation", "Will be ready by March 1"],
        unansweredQuestions: ["Firm date?"],
        consultationQuestions: ["What will you wear first?", "The suit will cost $4,500 — ok?"],
        suggestedActions: [
          { title: "Confirm", why: "Asked for Saturday", tradeoffs: [], decisionForAndrew: "Which time?" },
          { title: "Quote $4,000", why: "Fits budget", tradeoffs: [], decisionForAndrew: "Send?" },
          { title: "Assess wealth", why: "He seems affluent", tradeoffs: [], decisionForAndrew: "?" },
        ],
        draftMessage: { subject: "Hi", body: "Dear Graham, your suit is $4,500." },
      },
      req,
      "live",
    );
    expect(out.summary).toContain("$3,000 – $6,000");
    expect(out.statedPreferences).toEqual(["Navy", "Budget: $3,000 – $6,000"]);
    expect(out.timingConstraints).toEqual(["Board presentation"]);
    expect(out.consultationQuestions).toEqual(["What will you wear first?"]);
    expect(out.suggestedActions.map((a) => a.title)).toEqual(["Confirm"]);
    expect(out.draftMessage.body).not.toContain("$4,500");
    expect(out.systemNotes.join(" ")).toMatch(/prices, measurements or availability/);
  });

  it("demo brief is schema-valid and clearly labeled as a sample", () => {
    const b = demoBrief(toBriefRequest(consented)!);
    expect(AIPreparationBriefSchema.safeParse(b).success).toBe(true);
    expect(b.mode).toBe("demo");
    expect(b.systemNotes[0]).toMatch(/Sample response/);
    expect(b.suggestedActions.length).toBeGreaterThanOrEqual(2);
  });
});
