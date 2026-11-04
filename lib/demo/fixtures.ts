import type {
  DiscoveryResult,
  IdentityCandidate,
  ProspectBrief,
  ProspectInput,
  ResearchFinding,
  ResearchSource,
  SuggestedAction,
} from "@/lib/schemas";
import { assignStatus } from "@/lib/research/sources";

/* ─────────────────────────────────────────────────────────────────
   DEMO MODE — FICTIONAL SAMPLE DATA.

   Every person, company and source below is invented. Source URLs use
   the reserved ".example" domain so they can never point at a real site.
   ───────────────────────────────────────────────────────────────── */

const RETRIEVED = "2026-10-28T15:00:00.000Z";

type SrcDef = [title: string, host: string, path: string, publishedAt?: string];
type FindingDef = [claim: string, category: ResearchFinding["category"], sourceIdx: number[], note?: string, conflicting?: boolean];
type ActionDef = Omit<SuggestedAction, "id" | "requiresHumanApproval" | "supportingFindingIds"> & { findings: number[] };

interface PersonDef {
  key: string;
  candidate: Omit<IdentityCandidate, "id" | "sourceIds"> & { sourceIdx: number[] };
  sources: SrcDef[];
  summary: string;
  findings: FindingDef[];
  gaps: string[];
  insights: string[];
  questions: string[];
  actions: ActionDef[];
}

function src(prefix: string, defs: SrcDef[]): ResearchSource[] {
  return defs.map(([title, host, path, publishedAt], i) => ({
    id: `S${i + 1}`,
    url: `https://${host}${path}`,
    title,
    publisher: host,
    retrievedAt: RETRIEVED,
    publishedAt,
    cited: true,
    sample: true,
    ...(prefix ? {} : {}),
  }));
}

export function candidateFor(def: PersonDef): IdentityCandidate {
  return {
    id: `demo-${def.key}`,
    name: def.candidate.name,
    role: def.candidate.role,
    organization: def.candidate.organization,
    region: def.candidate.region,
    distinguishingDetails: def.candidate.distinguishingDetails,
    sourceIds: def.candidate.sourceIdx.map((i) => `S${i + 1}`),
  };
}

export function buildDemoBrief(def: PersonDef, input: ProspectInput, identityStatus: ProspectBrief["identityStatus"]): ProspectBrief {
  const sources = src(def.key, def.sources);
  const findings: ResearchFinding[] = def.findings.map(([claim, category, idx, note, conflicting], i) => {
    const sourceIds = idx.map((n) => `S${n + 1}`);
    return {
      id: `F${i + 1}`,
      claim,
      category,
      sourceIds,
      verificationStatus: assignStatus(sourceIds, sources, Boolean(conflicting)),
      uncertaintyNote: note ?? (sourceIds.length === 0 ? "No source was linked to this statement." : undefined),
    };
  });
  const actions: SuggestedAction[] = def.actions.map((a, i) => ({
    id: `demo-${def.key}-A${i + 1}`,
    title: a.title,
    description: a.description,
    rationale: a.rationale,
    supportingFindingIds: a.findings.map((n) => `F${n + 1}`),
    tradeoffs: a.tradeoffs,
    uncertainties: a.uncertainties,
    missingInformation: a.missingInformation,
    decisionForAndrew: a.decisionForAndrew,
    requiresHumanApproval: true,
  }));
  const c = candidateFor(def);
  return {
    id: `demo-brief-${def.key}`,
    input,
    customerProvided: {
      clothingInterest: input.clothingInterest,
      statedBudget: input.statedBudget,
      notes: input.notes,
      sharedWithAI: true,
    },
    identityStatus,
    identity: c,
    professionalProfile: {
      name: c.name,
      role: c.role,
      organization: c.organization,
      location: c.region,
      summary: def.summary,
    },
    findings,
    sources,
    sourceIds: sources.map((s) => s.id),
    missingInformation: def.gaps,
    preparationInsights: def.insights,
    suggestedQuestions: def.questions,
    suggestedActions: actions,
    systemNotes: ["Sample data: this person, their organization and every source are fictional."],
    researchedAt: RETRIEVED,
    mode: "demo",
  };
}

/* ── People ─────────────────────────────────────────────────────── */

export const PEOPLE: Record<string, PersonDef> = {
  ellery: {
    key: "ellery",
    candidate: {
      name: "Marcus Ellery",
      role: "Managing Partner",
      organization: "Ellery & Vance LLP",
      region: "Indianapolis, IN",
      distinguishingDetails: ["Commercial litigation attorney", "Firm offices on Monument Circle"],
      sourceIdx: [0],
    },
    sources: [
      ["Marcus Ellery — Attorneys", "ellery-vance.example", "/attorneys/marcus-ellery"],
      ["Ellery & Vance names new managing partner", "circle-city-business.example", "/2025/02/ellery-vance-managing-partner", "2025-02-11"],
      ["Board of Directors", "indy-arts-council.example", "/about/board"],
      ["2026 Litigation Leaders list", "midwest-legal-review.example", "/lists/2026-litigation-leaders", "2026-03-02"],
    ],
    summary:
      "Marcus Ellery is the managing partner of Ellery & Vance LLP, a commercial litigation firm in downtown Indianapolis, and has led the firm since early 2025. Public sources describe a trial-focused practice, a leadership role on a regional arts council board and recognition in a 2026 litigation list. His firm biography and a business-press article agree on his role.",
    findings: [
      ["Serves as managing partner of Ellery & Vance LLP.", "role", [0, 1]],
      ["Ellery & Vance is a commercial litigation firm with offices on Monument Circle in Indianapolis.", "company", [0]],
      ["Became managing partner in February 2025, succeeding a founding partner.", "career", [1]],
      ["Practices as a trial attorney in commercial disputes and regularly appears in court.", "career", [0]],
      ["Serves on the board of directors of the Indianapolis Arts Council.", "affiliation", [2]],
      ["Named to a 2026 regional 'Litigation Leaders' list.", "accomplishment", [3], "Single publication; the selection criteria are not described."],
    ],
    gaps: [
      "Preferred style, fit history or past tailoring experience",
      "How soon he needs the garments (e.g. an upcoming trial or event)",
      "Whether the stated budget covers all items listed on his card",
    ],
    insights: [
      "His card mentions trial work; frequent court appearances may make durable, conservative suiting and multiple rotations relevant to discuss.",
      "He told you he prefers Saturday appointments — offering weekend times may respect a demanding weekday schedule.",
      "His arts council board role means he may attend evening events; ask whether occasion wear is of interest rather than assuming.",
    ],
    questions: [
      "What will these suits mostly be worn for — court, client meetings, or both?",
      "Have you had garments made to measure before? What worked and what didn't?",
      "Is there a date you need the first suit ready by?",
      "How do you prefer to handle fittings — at the studio, or at your office?",
    ],
    actions: [
      {
        title: "Prepare an invitation to consult",
        description: "Draft a personal invitation offering a Saturday consultation focused on business suiting.",
        rationale: "His role is corroborated by two independent sources and his card states a specific interest and budget.",
        findings: [0, 3],
        tradeoffs: ["Moves quickly while interest is fresh", "Less time to learn his timeline before meeting"],
        uncertainties: ["Whether he wants a full consultation or a first conversation"],
        missingInformation: ["Preferred timing"],
        decisionForAndrew: "Do you have enough to extend an invitation now, and what would you offer?",
      },
      {
        title: "Request a little more information first",
        description: "Send a short note asking about timing and what the suits are for before scheduling.",
        rationale: "The card does not say when he needs the garments, which affects how you would plan the first appointment.",
        findings: [3],
        tradeoffs: ["Better-prepared first meeting", "Adds a step and may slow things down"],
        uncertainties: ["Whether he will reply to a questionnaire-style note"],
        missingInformation: ["Timeline", "Fit history"],
        decisionForAndrew: "Is the missing timing important enough to ask before inviting him?",
      },
      {
        title: "Save for later",
        description: "Keep the brief on the Decision Desk and revisit after your current commitments.",
        rationale: "Nothing in the research suggests urgency; the card was filled in at a networking event.",
        findings: [],
        tradeoffs: ["No pressure on your schedule", "His interest may cool"],
        uncertainties: ["How time-sensitive his request is"],
        missingInformation: [],
        decisionForAndrew: "Is now the right time to take this on?",
      },
    ],
  },

  whitfieldCfo: {
    key: "whitfield-cfo",
    candidate: {
      name: "James Whitfield",
      role: "Chief Financial Officer",
      organization: "Northbrook Logistics",
      region: "Fishers, IN",
      distinguishingDetails: ["Finance executive at a regional freight company", "Joined Northbrook in 2021"],
      sourceIdx: [0],
    },
    sources: [
      ["Leadership Team", "northbrook-logistics.example", "/about/leadership"],
      ["Northbrook Logistics opens Whitestown hub", "hamilton-county-ledger.example", "/news/northbrook-whitestown-hub", "2026-05-19"],
      ["Speakers — Indiana Supply Chain Forum 2026", "in-supply-chain-forum.example", "/2026/speakers"],
    ],
    summary:
      "This James Whitfield is the chief financial officer of Northbrook Logistics, a regional freight and warehousing company based in Fishers. His company leadership page lists the role; a local news article quotes him about a new distribution hub. Another person with the same name works in medicine in Ohio — make sure the prospect is this person before relying on this brief.",
    findings: [
      ["Serves as chief financial officer of Northbrook Logistics.", "role", [0, 1]],
      ["Northbrook Logistics is a regional freight and warehousing company headquartered in Fishers, Indiana.", "company", [0]],
      ["Joined Northbrook in 2021 after a finance career in manufacturing.", "career", [0], "Only the company's own page describes his prior career."],
      ["Was a listed speaker at the 2026 Indiana Supply Chain Forum.", "affiliation", [2]],
      ["Was quoted about the company's new Whitestown distribution hub in May 2026.", "accomplishment", [1]],
    ],
    gaps: [
      "Confirmation that the person who filled in the card is this James Whitfield",
      "Wedding date and his role in it (groom or guest)",
      "Whether he wants to buy or would consider other options",
    ],
    insights: [
      "His card mentions a June wedding; formalwear has a fixed deadline, so timing is the first thing to confirm.",
      "Two people share this name; the card's Indianapolis region fits the Fishers CFO better than the Ohio surgeon, but that is not confirmation.",
    ],
    questions: [
      "What is the date of the wedding, and are you the groom?",
      "Is the wedding black tie, or is there flexibility on the look?",
      "Would you also want something you could wear again afterwards?",
    ],
    actions: [
      {
        title: "Confirm identity and timing first",
        description: "Reply to his card with a short note asking about the wedding date before any further research.",
        rationale: "Two professionals share his name; the card gives only a name, region and occasion.",
        findings: [0],
        tradeoffs: ["Avoids preparing for the wrong person", "Adds one exchange before an invitation"],
        uncertainties: ["Which James Whitfield filled in the card"],
        missingInformation: ["Wedding date", "Confirmation of identity"],
        decisionForAndrew: "Should you confirm who he is before investing more preparation?",
      },
      {
        title: "Prepare an invitation to a formalwear consultation",
        description: "Invite him for a consultation focused on wedding attire with a timeline discussion.",
        rationale: "A June wedding implies a fixed lead time; an early conversation leaves room for fittings.",
        findings: [0, 4],
        tradeoffs: ["Respects the deadline", "Assumes the identity match is correct"],
        uncertainties: ["Exact date and dress code"],
        missingInformation: ["Wedding date"],
        decisionForAndrew: "Is the identity match strong enough to invite him now?",
      },
    ],
  },

  whitfieldMd: {
    key: "whitfield-md",
    candidate: {
      name: "James Whitfield",
      role: "Orthopedic Surgeon",
      organization: "Meridian Orthopedic Partners",
      region: "Columbus, OH",
      distinguishingDetails: ["Physician practising in central Ohio", "Sports-medicine focus"],
      sourceIdx: [0],
    },
    sources: [
      ["James Whitfield, MD — Physicians", "meridian-ortho.example", "/physicians/james-whitfield"],
      ["Team physicians announced for 2026 season", "columbus-sports-wire.example", "/2026/team-physicians", "2026-01-08"],
    ],
    summary:
      "This James Whitfield is an orthopedic surgeon with Meridian Orthopedic Partners in Columbus, Ohio, with a sports-medicine focus. He does not appear connected to Indianapolis in the sources found, which makes him a less likely match for a card filled in at your Carmel studio.",
    findings: [
      ["Practises as an orthopedic surgeon at Meridian Orthopedic Partners.", "role", [0]],
      ["Meridian Orthopedic Partners is a physician group in Columbus, Ohio.", "company", [0]],
      ["Serves as a team physician for a Columbus amateur sports league.", "affiliation", [1]],
    ],
    gaps: ["Any connection to the Indianapolis area", "Whether he filled in the card"],
    insights: ["No source links this person to Indiana; treat this as the less likely match unless he confirms."],
    questions: ["Where are you based — would travel to Carmel for fittings work for you?"],
    actions: [
      {
        title: "Confirm identity before anything else",
        description: "Ask a simple question about where he is based.",
        rationale: "No source connects this person to the Indianapolis area.",
        findings: [1],
        tradeoffs: ["Clarifies quickly", "Delays any invitation"],
        uncertainties: ["Whether this is the right person"],
        missingInformation: ["Location"],
        decisionForAndrew: "Is it worth confirming, or should you research the other match?",
      },
      {
        title: "Dismiss this match",
        description: "Set this candidate aside and go back to the other James Whitfield.",
        rationale: "The card's region fits the other candidate better.",
        findings: [],
        tradeoffs: ["Saves time", "Could set aside the right person"],
        uncertainties: ["Region on the card may be approximate"],
        missingInformation: [],
        decisionForAndrew: "Are you comfortable setting this match aside?",
      },
    ],
  },

  teller: {
    key: "teller",
    candidate: {
      name: "Ryan Teller",
      role: "Founder",
      organization: "Teller Analytics",
      region: "Carmel, IN",
      distinguishingDetails: ["Early-stage data analytics company"],
      sourceIdx: [0],
    },
    sources: [["About Teller Analytics", "telleranalytics.example", "/about"]],
    summary:
      "Public information about Ryan Teller is limited. A single company website lists him as founder of Teller Analytics, an early-stage analytics firm in Carmel. No business press, affiliations or independent sources were found, so most of this brief is unconfirmed.",
    findings: [
      ["Listed as founder of Teller Analytics.", "role", [0], "Only the company's own website; no independent confirmation."],
      ["Teller Analytics describes itself as a data analytics consultancy based in Carmel, Indiana.", "company", [0]],
      ["Previously worked in corporate analytics roles.", "career", [], "Mentioned without detail; employer names not given."],
    ],
    gaps: [
      "Independent confirmation of his role",
      "Size and stage of the company",
      "Professional affiliations or public activities",
      "What occasion or need prompted the interest card",
    ],
    insights: [
      "With little public information, the conversation itself will be the main source — plan an open, exploratory first meeting.",
      "His card asks about 'a first good suit', so explaining your process may matter more than discussing options in depth.",
    ],
    questions: [
      "What prompted you to look into custom clothing now?",
      "Where would you wear the suit most often?",
      "Have you had anything tailored before?",
    ],
    actions: [
      {
        title: "Request more information",
        description: "Send a friendly note asking what he has in mind and when.",
        rationale: "Research found very little; only one self-published source.",
        findings: [0],
        tradeoffs: ["Fills gaps directly from him", "Some people find questionnaires off-putting"],
        uncertainties: ["Everything beyond his name and company"],
        missingInformation: ["Occasion", "Timeline"],
        decisionForAndrew: "Would you rather learn more before meeting, or learn it in the meeting?",
      },
      {
        title: "Offer an introductory visit",
        description: "Invite him for a short, no-obligation visit to the studio to talk through the process.",
        rationale: "His card describes a first suit; an introductory visit may suit someone new to custom clothing.",
        findings: [1],
        tradeoffs: ["Low-pressure first step", "Uses an appointment slot with little preparation"],
        uncertainties: ["His timeline and expectations"],
        missingInformation: ["Occasion"],
        decisionForAndrew: "Is an introductory visit the right format given what you know?",
      },
      {
        title: "Save for later",
        description: "Keep the card on file and revisit when you have more capacity.",
        rationale: "No urgency is indicated on the card.",
        findings: [],
        tradeoffs: ["No effort now", "May miss his window"],
        uncertainties: ["Whether he has a deadline"],
        missingInformation: [],
        decisionForAndrew: "Does this fit your current calendar?",
      },
    ],
  },

  marsh: {
    key: "marsh",
    candidate: {
      name: "Helen Marsh",
      role: "President & CEO",
      organization: "Circle City Community Bank",
      region: "Indianapolis, IN",
      distinguishingDetails: ["Community bank executive"],
      sourceIdx: [0],
    },
    sources: [
      ["Executive Leadership", "circlecitycommunitybank.example", "/about/leadership"],
      ["Circle City Community Bank appoints Marsh as CEO", "circle-city-business.example", "/2024/09/ccc-bank-ceo", "2024-09-03"],
    ],
    summary:
      "Helen Marsh is president and CEO of Circle City Community Bank, a community bank in Indianapolis, appointed in 2024. Her bank's leadership page and a business-press article agree on the role.",
    findings: [
      ["Serves as president and CEO of Circle City Community Bank.", "role", [0, 1]],
      ["Appointed CEO in September 2024.", "career", [1]],
      ["Circle City Community Bank operates branches in Marion and Hamilton counties.", "company", [0]],
    ],
    gaps: ["Any expressed interest in custom clothing", "How she would prefer to be contacted"],
    insights: ["There is no interest card for this person — any outreach would be unsolicited, which deserves extra care."],
    questions: ["What would make a first conversation welcome rather than intrusive?"],
    actions: [
      {
        title: "Save for later",
        description: "Keep the profile on file without contacting her.",
        rationale: "She has not expressed interest; research alone is not a reason to reach out.",
        findings: [0],
        tradeoffs: ["Respectful", "No relationship develops"],
        uncertainties: ["Whether she would welcome an introduction"],
        missingInformation: ["Interest"],
        decisionForAndrew: "Is there a natural, appropriate way to be introduced, or should you wait?",
      },
      {
        title: "Dismiss",
        description: "Remove from the shortlist.",
        rationale: "No stated interest or connection.",
        findings: [],
        tradeoffs: ["Keeps the desk focused", "Loses the research done"],
        uncertainties: [],
        missingInformation: [],
        decisionForAndrew: "Is this profile worth keeping?",
      },
    ],
  },

  lindqvist: {
    key: "lindqvist",
    candidate: {
      name: "Victor Lindqvist",
      role: "Founder & CEO",
      organization: "Lindqvist Precision Manufacturing",
      region: "Noblesville, IN",
      distinguishingDetails: ["Precision machining company founder"],
      sourceIdx: [0],
    },
    sources: [
      ["Our Story", "lindqvist-precision.example", "/our-story"],
      ["Manufacturer of the Year finalists", "indiana-manufacturers.example", "/awards/2026-finalists", "2026-04-14"],
    ],
    summary:
      "Victor Lindqvist founded Lindqvist Precision Manufacturing in Noblesville and leads it as CEO. The company's site describes its history; an industry association lists the company as a 2026 award finalist.",
    findings: [
      ["Founder and CEO of Lindqvist Precision Manufacturing.", "role", [0]],
      ["Founded the company in 2009 in Noblesville, Indiana.", "career", [0]],
      ["The company was a 2026 Manufacturer of the Year finalist.", "accomplishment", [1]],
    ],
    gaps: ["Any expressed interest in custom clothing", "Whether his role involves client-facing events"],
    insights: ["No interest card exists; treat this as background only."],
    questions: ["Is there a mutual connection who could make an introduction?"],
    actions: [
      {
        title: "Save for later",
        description: "Keep on file as background.",
        rationale: "Role is documented, but there is no indication of interest.",
        findings: [0, 2],
        tradeoffs: ["No intrusion", "No progress"],
        uncertainties: ["Interest"],
        missingInformation: ["Interest"],
        decisionForAndrew: "Should this stay on your radar?",
      },
      {
        title: "Research another aspect",
        description: "Look for public events where he speaks or attends, to understand his professional calendar.",
        rationale: "Could reveal a natural context for an introduction.",
        findings: [2],
        tradeoffs: ["More context", "Time spent on someone with no stated interest"],
        uncertainties: ["Whether anything relevant is public"],
        missingInformation: [],
        decisionForAndrew: "Is more research worthwhile here?",
      },
    ],
  },
};

/* ── Scenarios Andrew can try in Demo Mode ──────────────────────── */

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  input: ProspectInput;
  people: string[];
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "clear",
    label: "Clear match",
    description: "A well-documented professional with a completed interest card.",
    input: {
      fullName: "Marcus Ellery",
      company: "Ellery & Vance",
      region: "Indianapolis",
      clothingInterest: "Two business suits for trial work and a navy blazer",
      statedBudget: "$4,000–$6,000",
      notes: "Met at a Carmel Chamber event. Prefers Saturday appointments.",
    },
    people: ["ellery"],
  },
  {
    id: "ambiguous",
    label: "Ambiguous name",
    description: "Two professionals share the name — Andrew chooses the right one.",
    input: {
      fullName: "James Whitfield",
      region: "Indianapolis area",
      clothingInterest: "Wedding in June — interested in a tuxedo",
    },
    people: ["whitfieldCfo", "whitfieldMd"],
  },
  {
    id: "thin",
    label: "Limited information",
    description: "Very little is public; the brief is mostly gaps.",
    input: {
      fullName: "Ryan Teller",
      company: "Teller Analytics",
      region: "Carmel",
      clothingInterest: "A first good suit",
      notes: "Walked in on a Thursday afternoon.",
    },
    people: ["teller"],
  },
];

/** Discovery shortlist used in Demo Mode. */
export function demoDiscoveryResults(): DiscoveryResult[] {
  const make = (
    key: string,
    relevance: string,
    level: "high" | "medium" | "low",
    reason: string,
    gaps: string[],
  ): DiscoveryResult => {
    const def = PEOPLE[key];
    const brief = buildDemoBrief(def, { fullName: def.candidate.name }, "single-match");
    return {
      id: `demo-disc-${key}`,
      person: def.candidate.name,
      professionalRole: def.candidate.role ?? "",
      organization: def.candidate.organization ?? "",
      region: def.candidate.region,
      evidence: brief.findings
        .filter((f) => f.sourceIds.length > 0)
        .slice(0, 2)
        .map((f) => ({ claim: f.claim, sourceIds: f.sourceIds, verificationStatus: f.verificationStatus })),
      sources: brief.sources,
      researchGaps: gaps,
      identityConfidence: { level, reason },
      relevanceExplanation: relevance,
      mode: "demo",
    };
  };
  return [
    make(
      "ellery",
      "Managing partner of a downtown law firm whose trial practice involves regular court and client appearances.",
      "high",
      "Firm biography and a business-press article agree on name, firm and role.",
      ["Any expressed interest in custom clothing"],
    ),
    make(
      "marsh",
      "Bank CEO whose role includes public-facing community and board engagements.",
      "high",
      "Bank leadership page and a business-press appointment article agree.",
      ["Any expressed interest in custom clothing", "Preferred way to be introduced"],
    ),
    make(
      "lindqvist",
      "Founder-CEO of a manufacturing company recognized at an industry awards event.",
      "medium",
      "Company website and an industry association page; no business-press coverage found.",
      ["Whether his role involves client-facing events"],
    ),
    make(
      "teller",
      "Founder of an early-stage Carmel consultancy; client-facing role as described on the company site.",
      "low",
      "Only the company's own website mentions him.",
      ["Independent confirmation of his role", "Company size and stage"],
    ),
  ];
}

export function demoPersonForName(name: string): string[] | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const scenario = DEMO_SCENARIOS.find((s) => s.input.fullName.toLowerCase() === n);
  if (scenario) return scenario.people;
  const person = Object.entries(PEOPLE).find(([, p]) => p.candidate.name.toLowerCase() === n);
  return person ? [person[0]] : null;
}

export function demoKeyForCandidate(candidateId: string): string | undefined {
  return Object.entries(PEOPLE).find(([, p]) => `demo-${p.key}` === candidateId)?.[0];
}
