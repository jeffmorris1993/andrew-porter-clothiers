import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("demo mode is clearly labeled", async ({ page }) => {
  await expect(page.getByTestId("mode-banner")).toContainText("Demo Mode · Sample data");
  await expect(page.getByRole("radio", { name: "Demo" })).toHaveAttribute("aria-checked", "true");
});

test("research a clear match: brief shows sections, sources and customer info separately", async ({ page }) => {
  await page.getByTestId("scenario-clear").click();
  await page.getByRole("button", { name: /Research sample prospect/ }).click();
  const brief = page.getByTestId("brief");
  await expect(brief.getByRole("heading", { name: "Marcus Ellery" })).toBeVisible();
  for (const h of ["Research summary", "Verified information", "Customer-provided information", "Information gaps", "Preparation insights", "Next-step options"])
    await expect(brief.getByRole("heading", { name: h })).toBeVisible();
  await expect(page.getByTestId("finding")).toHaveCount(6);
  await expect(page.getByTestId("finding").first().locator('[data-status="corroborated"]')).toBeVisible();
  // Sample sources are labeled and are not live links.
  const chip = page.getByTestId("source-chip").first();
  await expect(chip).toContainText("sample");
  expect(await chip.evaluate((el) => el.tagName)).toBe("SPAN");
  await expect(page.getByTestId("customer-provided")).toContainText("$4,000–$6,000");
  await expect(page.getByTestId("customer-provided")).toContainText("Provided by the prospect");
  // No option is chosen automatically.
  await expect(page.getByTestId("option-card")).toHaveCount(3);
  await expect(page.getByTestId("decision-recorded")).toHaveCount(0);
  await page.getByRole("button", { name: "I'll take this option" }).first().click();
  await page.getByRole("button", { name: "Confirm my decision" }).click();
  await expect(page.getByTestId("decision-recorded")).toHaveCount(1);
});

test("ambiguous identity: Andrew chooses, details are not merged", async ({ page }) => {
  await page.getByTestId("scenario-ambiguous").click();
  await page.getByRole("button", { name: /Research sample prospect/ }).click();
  await expect(page.getByTestId("candidate")).toHaveCount(2);
  await expect(page.getByTestId("brief")).toHaveCount(0);
  await page.getByTestId("candidate").filter({ hasText: "Northbrook" }).getByRole("button", { name: "This is the person" }).click();
  await expect(page.getByTestId("brief")).toContainText("Identity chosen by you");
  await expect(page.getByTestId("brief")).toContainText("Northbrook Logistics");
  await expect(page.getByTestId("brief")).not.toContainText("Meridian Orthopedic Partners is a physician group");
});

test("unknown name in demo mode shows an honest empty state", async ({ page }) => {
  await page.getByLabel(/Full name/).fill("Someone Unknown");
  await page.getByRole("button", { name: /Research sample prospect/ }).click();
  await expect(page.getByTestId("not-found")).toContainText("No credible public match found");
});

test("discover → research a result → save and compare on the desk", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Find professionals" }).click();
  await expect(page.getByTestId("discovery-card")).toHaveCount(4);
  await expect(page.getByTestId("fewer-notice")).toBeVisible();
  await page.getByTestId("discovery-card").filter({ hasText: "Victor Lindqvist" }).getByRole("button", { name: "Research this person" }).click();
  await expect(page).toHaveURL(/\/research/);
  await expect(page.getByTestId("brief").getByRole("heading", { name: "Victor Lindqvist" })).toBeVisible();
  await page.getByTestId("save-brief").click();
  await page.goto("/desk");
  await expect(page.getByTestId("saved-item").filter({ hasText: "Victor Lindqvist" })).toBeVisible();
});

test("decision desk: compare, limit of three, evidence, editable drafts", async ({ page }) => {
  await page.goto("/desk");
  const table = page.getByTestId("comparison");
  await expect(table).toContainText("Marcus Ellery");
  await expect(table).toContainText("Ryan Teller");
  await page.getByLabel("Compare Helen Marsh").check();
  await expect(table).toContainText("Helen Marsh");
  // Evidence drawer
  await table.getByRole("button", { name: "Evidence" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Evidence — Marcus Ellery");
  await page.keyboard.press("Escape");
  // Decide view with drafts
  await table.getByRole("button", { name: "Decide" }).first().click();
  await expect(page.getByTestId("focus-panel")).toBeVisible();
  await page.getByRole("button", { name: "Generate draft" }).click();
  const body = page.getByLabel("Message");
  await expect(body).toHaveValue(/Dear Marcus/);
  await body.fill("Dear Marcus,\n\nEdited by Andrew.");
  await expect(page.getByTestId("email-draft")).toContainText("Edited by you");
  await expect(page.getByTestId("email-draft")).toContainText("Not sent");
  await page.getByRole("button", { name: "Generate simulated note" }).click();
  await expect(page.getByLabel("Simulated CRM note")).toHaveValue(/SIMULATED INSIGHTLY NOTE/);
});

test("ask the AI uses the research context (demo: labeled sample answer)", async ({ page }) => {
  await page.getByTestId("scenario-clear").click();
  await page.getByRole("button", { name: /Research sample prospect/ }).click();
  await page.getByRole("button", { name: "Ask about this research" }).click();
  await page.getByRole("button", { name: "What information is missing?" }).click();
  const a = page.getByTestId("assistant-answer");
  await expect(a).toContainText("Sample response");
  await expect(a).toContainText("Preferred style");
});

test("research page has no serious accessibility violations", async ({ page }) => {
  const r = await new AxeBuilder({ page }).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("brief has no serious accessibility violations", async ({ page }) => {
  await page.getByTestId("scenario-clear").click();
  await page.getByRole("button", { name: /Research sample prospect/ }).click();
  await expect(page.getByTestId("brief")).toBeVisible();
  const r = await new AxeBuilder({ page }).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("layouts fit a phone screen @mobile", async ({ page }) => {
  for (const path of ["/research", "/discover", "/desk"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, path).toBeLessThanOrEqual(w);
  }
});
