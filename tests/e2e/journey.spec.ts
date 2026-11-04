import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function fresh(page: Page) {
  await page.goto("/journey");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  page.on("dialog", (d) => d.accept());
}

async function completeIntake(page: Page) {
  await page.getByTestId("journey-begin").click();
  await page.getByTestId("fill-sample").click();
  await page.getByTestId("interest-next").click();
  await page.getByTestId("interest-next").click();
  await page.getByTestId("interest-submit").click();
  await page.getByTestId("fill-style").click();
  await page.getByTestId("style-submit").click();
  await page.getByTestId("slot-Saturday · 10:30 am").click();
  await page.getByTestId("request-consultation").click();
}

test("navigation: all four workspaces load", async ({ page }) => {
  await page.goto("/research");
  for (const [name, heading] of [
    ["Discover Professionals", "Discover Professionals"],
    ["Decision Desk", "Decision Desk"],
    ["Client Journey", "Client Journey"],
    ["Research Prospect", "Research Prospect"],
  ]) {
    await page.getByRole("navigation", { name: "Workspaces" }).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("intake validation keeps the customer on the step with a clear message", async ({ page }) => {
  await fresh(page);
  await page.getByTestId("journey-begin").click();
  await page.getByTestId("interest-next").click();
  await expect(page.getByText("Choose at least one")).toBeVisible();
});

test("the full demo story, end to end, then reset", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("journey-simulated-banner")).toContainText("Simulated client journey");
  await completeIntake(page);

  const portal = page.getByTestId("client-portal");
  await expect(portal).toContainText("Welcome, Graham.");
  await expect(page.getByTestId("portal-appointment")).toContainText("Awaiting confirmation");
  await expect(page.getByTestId("new-inquiry-badge")).toBeVisible();

  // Andrew sees the inquiry already organized.
  await page.getByTestId("perspective-andrew").click();
  const overview = page.getByTestId("client-overview");
  await expect(overview).toContainText("Graham Whitcombe");
  await expect(overview).toContainText("$3,000 – $6,000 (their own range)");
  await expect(overview).toContainText("Style preferences — not garment specifications");

  // The brief needs Andrew's consent confirmation, then is labeled as a sample.
  await expect(page.getByTestId("generate-brief")).toBeDisabled();
  await page.getByTestId("andrew-consent").check();
  await page.getByTestId("generate-brief").click();
  await expect(page.getByTestId("prep-brief")).toContainText("Sample response · not AI");

  // Approve and share a personal message.
  await page.getByTestId("approve-appointment").click();
  await expect(page.getByTestId("decision-appointment")).toContainText("Confirmed for Saturday · 10:30 am");
  await expect(page.getByLabel("Message")).toHaveValue(/Saturday · 10:30 am/);
  await page.getByLabel("Message").fill("Dear Graham,\n\nEdited personally by Andrew.");
  await page.getByTestId("share-message").click();

  // The customer portal reflects it.
  await page.getByTestId("perspective-customer").click();
  await expect(page.getByTestId("portal-stage")).toHaveText(/Consultation confirmed/);
  await expect(page.getByTestId("portal-appointment")).toContainText("Saturday · 10:30 am");
  await expect(page.getByTestId("portal-messages")).toContainText("Edited personally by Andrew.");

  // Andrew advances the order; the customer timeline follows.
  await page.getByTestId("perspective-andrew").click();
  await page.getByTestId("complete-consultation").click();
  for (let i = 0; i < 4; i++) await page.getByTestId("advance-milestone").click();
  await page.getByTestId("perspective-customer").click();
  await expect(page.getByTestId("portal-stage")).toHaveText(/Fitting or adjustments/);
  await expect(page.locator('[data-testid=milestone][data-status=done]')).toHaveCount(5);

  await page.getByTestId("perspective-andrew").click();
  for (let i = 0; i < 3; i++) await page.getByTestId("advance-milestone").click();
  await expect(page.getByTestId("journey-activity")).toContainText("Completed");
  await page.getByTestId("perspective-customer").click();
  await expect(page.getByTestId("client-portal")).toContainText("Welcome back, Graham.");
  await expect(page.getByTestId("past-orders")).toContainText("Custom suit & Custom shirts");
  await page.getByTestId("request-another").click();
  await expect(page.getByTestId("portal-appointment")).toContainText("Awaiting confirmation");

  // Reset returns to the beginning and leaves research untouched.
  await page.getByTestId("reset-journey").click();
  await expect(page.getByTestId("journey-begin")).toBeVisible();
  await page.goto("/desk");
  await expect(page.getByTestId("saved-item")).toHaveCount(3);
});

test("both perspectives stay in sync across two tabs", async ({ context, page }) => {
  await fresh(page);
  const andrew = await context.newPage();
  await andrew.goto("/journey");
  await andrew.getByTestId("perspective-andrew").click();
  await expect(andrew.getByText("No inquiry yet")).toBeVisible();

  await page.bringToFront();
  await completeIntake(page);
  await andrew.bringToFront();
  await expect(andrew.getByTestId("client-overview")).toContainText("Graham Whitcombe");
  await andrew.getByTestId("approve-appointment").click();
  await page.bringToFront();
  await expect(page.getByTestId("portal-appointment")).toContainText("Saturday · 10:30 am");
});

test("live mode: real-AI label, consent-only payload, errors shown without fallback", async ({ page }) => {
  await fresh(page);
  let sent: Record<string, unknown> | null = null;
  let fail = true;
  await page.route("**/api/journey/brief", (r) => {
    sent = r.request().postDataJSON();
    if (fail) return r.fulfill({ status: 503, json: { error: { code: "upstream_rate_limited", message: "OpenAI rate limit reached.", retryable: true } } });
    return r.fulfill({
      json: {
        summary: "Graham is looking for a suit for a new role.",
        statedPreferences: ["Navy"],
        timingConstraints: [],
        unansweredQuestions: [],
        consultationQuestions: ["When is the presentation?"],
        suggestedActions: [{ title: "Confirm", why: "Asked", tradeoffs: [], decisionForAndrew: "Which time?" }],
        draftMessage: { subject: "Welcome", body: "Dear Graham" },
        systemNotes: [],
        mode: "live",
        generatedAt: new Date().toISOString(),
        usage: { model: "gpt-5.4-mini", calls: 1, webSearchCalls: 0, inputTokens: 900, outputTokens: 300, reasoningTokens: 0, totalTokens: 1200, durationMs: 4000 },
      },
    });
  });
  await page.getByRole("radio", { name: "Live" }).click();
  await expect(page.getByTestId("journey-simulated-banner")).toContainText("even in Live Mode");
  await completeIntake(page);
  await page.getByTestId("perspective-andrew").click();
  await page.getByTestId("andrew-consent").check();
  await page.getByTestId("generate-brief").click();
  await expect(page.getByTestId("error-panel")).toContainText("No sample data was substituted");
  expect(JSON.stringify(sent)).not.toContain("@example.com");
  expect(JSON.stringify(sent)).not.toContain("Whitcombe");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("prep-brief")).toContainText("Live AI interpretation");
  await expect(page.getByTestId("usage-line")).toContainText("0 web searches");
});

test("journey screens have no serious accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page);
  const check = async () => {
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  };
  await check();
  await completeIntake(page);
  await check();
  await page.getByTestId("perspective-andrew").click();
  await check();
});

test("journey fits a phone screen @mobile", async ({ page }) => {
  await fresh(page);
  await completeIntake(page);
  for (const p of ["customer", "andrew"]) {
    await page.getByTestId(`perspective-${p}`).click();
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, p).toBeLessThanOrEqual(w);
  }
});
