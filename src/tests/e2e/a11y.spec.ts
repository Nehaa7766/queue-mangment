import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { RECEPTION_STATE } from "./auth-state";

// WCAG 2.1 A and AA rules. Serious and critical violations fail the test;
// minor and moderate ones are left to design review.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoSeriousViolations(page: Page) {
  // Polling pages never go fully idle, but this waits out the first fetches.
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const serious = results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact!))
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
  expect(serious).toEqual([]);
}

// Pediatrics, so these joins don't share a rate-limit bucket with the
// patient spec, which joins General.
async function openPediatricsConfirmation(page: Page) {
  await page.goto("/q/demo-clinic");
  await page.getByRole("link", { name: /Pediatrics/ }).click();
  await expect(page).toHaveURL(/\/q\/demo-clinic\/join\/[^/]+$/);
}

test.describe("public pages", () => {
  test("home page", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousViolations(page);
  });

  test("sign-in page", async ({ page }) => {
    await page.goto("/login");
    await expectNoSeriousViolations(page);
  });

  test("clinic page", async ({ page }) => {
    await page.goto("/q/demo-clinic");
    await expect(
      page.getByRole("heading", { name: "Demo Clinic" }),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("join confirmation", async ({ page }) => {
    await openPediatricsConfirmation(page);
    await expectNoSeriousViolations(page);
  });

  test("token page", async ({ page }) => {
    await openPediatricsConfirmation(page);
    await page.getByRole("button", { name: "Join queue" }).click();
    await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
    await expect(page.getByTestId("token-label")).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test.describe("reception pages", () => {
  test.use({ storageState: RECEPTION_STATE });

  for (const path of [
    "/receptionist",
    "/receptionist/queue",
    "/receptionist/walk-in",
    "/receptionist/history",
  ]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  }
});
