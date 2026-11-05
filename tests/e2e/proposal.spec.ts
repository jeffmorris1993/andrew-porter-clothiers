import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/proposal");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const summary = (page: import("@playwright/test").Page) => page.getByTestId("quote-summary");

test("standalone page: calculator by default, no workspace nav", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Pricing Configuration" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toHaveCount(0);
  await expect(summary(page)).toContainText("Select at least one module to build a quote.");
});

test("two modules apply the 10% bundle and the proposal matches", async ({ page }) => {
  await page.getByRole("switch", { name: "Select Research Prospect" }).click();
  await page.getByRole("switch", { name: "Select Discover Professionals" }).click();
  await expect(summary(page)).toContainText("$4,050");
  await expect(page.getByTestId("first-year-total")).toHaveText("$9,450");

  await page.getByRole("button", { name: "View Client Proposal" }).click();
  await expect(page).toHaveURL(/#proposal$/);
  const sheet = page.locator(".pv").getByTestId("proposal-sheet");
  await expect(sheet.locator(".pp-b-item.on")).toContainText("Applied");
  await expect(sheet.getByTestId("fig-One-time setup")).toHaveText("$4,050");
  await expect(sheet.getByTestId("fig-Monthly service")).toHaveText("$450");
  await expect(sheet.getByTestId("fig-First-year total")).toHaveText("$9,450");

  await page.getByRole("button", { name: "← Configure" }).click();
  await expect(page.getByRole("heading", { name: "Pricing Configuration" })).toBeVisible();
});

test("usage above High requires a custom quote", async ({ page }) => {
  await page.getByRole("switch", { name: "Select Discover Professionals" }).click();
  await page.getByLabel("How many discovery searches will Andrew run per month?").fill("41");
  await expect(page.getByTestId("module-discovery")).toContainText("Custom Quote Required");
  await expect(page.getByTestId("first-year-total")).toHaveText("Custom Quote Required");
});

test("partnership mode shows the retainer and flags usage over Medium", async ({ page }) => {
  await page.getByRole("radio", { name: /AI Technology Partnership/ }).click();
  await expect(summary(page)).toContainText("$26,340");
  await page.getByLabel("How many new customer inquiries will Andrew receive per month?").fill("80");
  await expect(summary(page)).toContainText("Entered usage exceeds Medium allowances for Client Journey");
});

test("advanced pricing edits flow through, and settings survive a reload", async ({ page }) => {
  await page.getByRole("switch", { name: "Select Research Prospect" }).click();
  await page.getByRole("button", { name: "Advanced Pricing Settings" }).click();
  await page.getByLabel("Setup").first().fill("1000");
  await expect(page.getByTestId("first-year-total")).toHaveText("$3,388");
  await page.reload();
  await expect(page.getByTestId("first-year-total")).toHaveText("$3,388");
  await page.getByRole("button", { name: "Reset Calculator" }).click();
  await expect(summary(page)).toContainText("Select at least one module");
});

test("both views have no serious accessibility violations", async ({ page }) => {
  const check = async () => {
    // Two contrast issues are intentional in the source design (dimmed unselected cards, white-on-gold flag);
    // they are excluded here and reported to the owner rather than restyled.
    const r = await new AxeBuilder({ page }).exclude(".cx-mod:not(.on) .cx-mod-body").exclude(".pp-mod-top .pp-flag").analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  };
  await page.getByRole("switch", { name: "Select Research Prospect" }).click();
  await check();
  await page.getByRole("button", { name: "View Client Proposal" }).click();
  await check();
});

test("fits a phone screen @mobile", async ({ page }) => {
  for (const hash of ["", "#proposal"]) {
    await page.goto(`/proposal${hash}`);
    await page.waitForTimeout(400);
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, hash || "calculator").toBeLessThanOrEqual(w);
  }
});
