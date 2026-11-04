import { expect, test } from "@playwright/test";

/* Live Mode UI against intercepted API responses shaped like real ones.
   (The real OpenAI integration is covered by the mocked integration tests
   and by the manual live check described in the README.) */

const SOURCES = [
  { id: "S1", url: "https://www.acmelogistics.com/leadership", title: "Leadership — Acme Logistics", publisher: "acmelogistics.com", retrievedAt: "2026-11-04T12:00:00Z", cited: true },
  { id: "S2", url: "https://www.ibj.com/articles/acme-cfo", title: "Acme names CFO", publisher: "ibj.com", retrievedAt: "2026-11-04T12:00:00Z", cited: true },
];
const candidate = { id: "c1", name: "Jane Smith", role: "CFO", organization: "Acme Logistics", region: "Fishers, IN", distinguishingDetails: ["Finance executive"], sourceIds: ["S1"] };
const usage = { model: "gpt-5.4-mini", calls: 2, webSearchCalls: 1, inputTokens: 3000, outputTokens: 900, reasoningTokens: 200, totalTokens: 3900, durationMs: 21000 };
const brief = {
  id: "live-1",
  input: { fullName: "Jane Smith" },
  customerProvided: { sharedWithAI: false },
  identityStatus: "single-match",
  identity: candidate,
  professionalProfile: { name: "Jane Smith", role: "CFO", organization: "Acme Logistics", location: "Fishers, IN", summary: "Jane Smith is CFO of Acme Logistics." },
  findings: [
    { id: "F1", claim: "Serves as CFO of Acme Logistics.", category: "role", sourceIds: ["S1", "S2"], verificationStatus: "corroborated" },
    { id: "F2", claim: "Holds an MBA.", category: "career", sourceIds: [], verificationStatus: "unverified", uncertaintyNote: "No source was linked." },
  ],
  sources: SOURCES,
  sourceIds: ["S1", "S2"],
  missingInformation: ["Clothing preferences"],
  preparationInsights: ["Role involves investor meetings."],
  suggestedQuestions: ["What will the suits be worn for?"],
  suggestedActions: [
    { id: "a1", title: "Request more information", description: "d", rationale: "r", supportingFindingIds: ["F1"], tradeoffs: ["t"], uncertainties: [], missingInformation: [], decisionForAndrew: "?", requiresHumanApproval: true },
    { id: "a2", title: "Save for later", description: "d", rationale: "r", supportingFindingIds: [], tradeoffs: [], uncertainties: [], missingInformation: [], decisionForAndrew: "?", requiresHumanApproval: true },
  ],
  systemNotes: ["Excluded results from linkedin.com (restricted or private-data sites are not used)."],
  researchedAt: "2026-11-04T12:00:00Z",
  mode: "live",
  usage,
};

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("radio", { name: "Live" }).click();
});

test("live mode banner and consent control", async ({ page }) => {
  await expect(page.getByTestId("mode-banner")).toContainText("Live Mode");
  await expect(page.getByText("Include the interest-card details in the AI analysis.")).toBeVisible();
  await expect(page.getByTestId("scenario-clear")).toHaveCount(0);
});

test("renders real citation links from a live brief", async ({ page }) => {
  let briefBody: Record<string, unknown> | null = null;
  await page.route("**/api/research/identify", (r) => r.fulfill({ json: { status: "single-match", candidates: [candidate], sources: SOURCES, mode: "live", usage } }));
  await page.route("**/api/research/brief", (r) => {
    briefBody = r.request().postDataJSON();
    return r.fulfill({ json: brief });
  });
  await page.getByLabel(/Full name/).fill("Jane Smith");
  await page.getByLabel("Self-reported budget").fill("$5,000");
  await page.getByRole("button", { name: /Research with live web search/ }).click();
  await expect(page.getByTestId("brief").getByRole("heading", { name: "Jane Smith" })).toBeVisible();
  // Consent was off: the request says so.
  expect(briefBody!.shareCustomerDetails).toBe(false);
  const link = page.locator('a[data-testid="source-chip"][href="https://www.acmelogistics.com/leadership"]').first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(page.locator('a[href="https://www.ibj.com/articles/acme-cfo"]').first()).toBeVisible();
  await expect(page.getByTestId("finding").filter({ hasText: "Holds an MBA" })).toContainText("Unverified");
  await expect(page.getByText("Excluded results from linkedin.com")).toBeVisible();
  await expect(page.getByTestId("usage-line")).toContainText("1 web search");
});

test("a failed live request shows an error and never substitutes sample data", async ({ page }) => {
  await page.route("**/api/research/identify", (r) =>
    r.fulfill({ status: 503, json: { error: { code: "upstream_rate_limited", message: "OpenAI rate limit or quota reached.", retryable: true } } }),
  );
  await page.getByLabel(/Full name/).fill("Marcus Ellery");
  await page.getByRole("button", { name: /Research with live web search/ }).click();
  await expect(page.getByTestId("error-panel")).toContainText("OpenAI rate limit");
  await expect(page.getByTestId("error-panel")).toContainText("No sample data was substituted");
  await expect(page.getByTestId("brief")).toHaveCount(0);
  // Retry works once the API recovers.
  await page.unroute("**/api/research/identify");
  await page.route("**/api/research/identify", (r) => r.fulfill({ json: { status: "not-found", candidates: [], sources: [], note: "No public match.", mode: "live", usage } }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("not-found")).toContainText("No public match.");
});

test("live discovery with fewer results than requested", async ({ page }) => {
  await page.route("**/api/discover", (r) =>
    r.fulfill({
      json: {
        request: { region: "Indianapolis", roles: ["CEO"], resultLimit: 5 },
        results: [
          { id: "d1", person: "Jane Smith", professionalRole: "CEO", organization: "Acme", region: "Indianapolis", evidence: [{ claim: "CEO of Acme", sourceIds: ["S1"], verificationStatus: "single-source" }], sources: [SOURCES[0]], researchGaps: [], identityConfidence: { level: "medium", reason: "Company page" }, relevanceExplanation: "CEO", mode: "live" },
        ],
        systemNotes: [],
        mode: "live",
        usage,
      },
    }),
  );
  await page.goto("/discover");
  await page.getByRole("button", { name: "Find professionals" }).click();
  await expect(page.getByTestId("discovery-card")).toHaveCount(1);
  await expect(page.getByTestId("fewer-notice")).toBeVisible();
  await expect(page.locator('a[href="https://www.acmelogistics.com/leadership"]')).toBeVisible();
});

test("demo and live desks are kept apart", async ({ page }) => {
  await page.goto("/desk");
  await expect(page.getByTestId("saved-item")).toHaveCount(0);
  await page.getByRole("radio", { name: "Demo" }).click();
  await expect(page.getByTestId("saved-item")).toHaveCount(3);
});
