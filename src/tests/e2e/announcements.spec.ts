import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { RECEPTION_STATE } from "./auth-state";

// Runs against the seeded demo clinic (prisma/seed.sql). The patient joins
// General: the other specs call tokens in Pediatrics and Dental, and this
// recipient has to stay waiting until the announcement reaches them.
test.use({ storageState: RECEPTION_STATE });

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact!))
    .map((violation) => ({
      rule: violation.id,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
  expect(serious).toEqual([]);
}

test("reception sends an announcement and follows its progress", async ({
  page,
  browser,
}, testInfo) => {
  // Announcements are limited to 5 per 10 minutes per clinic, so one
  // project sends one.
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );

  // A waiting patient, signed out, in their own browser context.
  const patientContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const patient = await patientContext.newPage();
  await patient.goto("/q/demo-clinic");
  await patient.getByRole("link", { name: /General/ }).click();
  await patient.getByLabel(/First name or initials/).fill("E2E Announce");
  await patient.getByRole("button", { name: "Join queue" }).click();
  await expect(patient).toHaveURL(/\/token\/[0-9a-f-]+$/);
  const label = (await patient.getByTestId("token-label").textContent())!;

  await page.goto("/receptionist/announcements");
  await expect(
    page.getByRole("heading", { name: "Announcements", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New announcement" }).click();
  const sheet = page.getByRole("dialog", { name: "New announcement" });
  const text = `E2E announcement ${Date.now().toString(36)}`;
  await sheet.getByRole("textbox", { name: "Message" }).fill(text);
  await sheet.getByText("Chosen services", { exact: true }).click();
  await sheet.getByRole("checkbox", { name: /General/ }).check();
  await expect(sheet.getByText(/will get this/)).toHaveText(
    /^[1-9][\d,]* patients? will get this$/,
  );

  // Nothing is sent until the confirmation.
  await sheet.getByRole("button", { name: "Send announcement" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "Each patient gets it as a separate private message",
  );
  await confirm
    .getByRole("button", { name: /^Send to [\d,]+ patients?$/ })
    .click();

  // The progress page follows delivery until every recipient is handled.
  // (Visible text only: Next.js keeps the list page mounted but hidden.)
  await expect(page).toHaveURL(/\/receptionist\/announcements\/[0-9a-f-]+$/);
  await expect(page.getByText(text).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/All [\d,]+ patients? handled\./)).toBeVisible({
    timeout: 20_000,
  });
  const recipients = page.getByRole("table", { name: "Recipients" });
  await expect(
    recipients.getByRole("row").filter({ hasText: label }),
  ).toContainText("Sent");
  await expectNoSeriousViolations(page);

  await page.getByRole("link", { name: "All announcements" }).click();
  await expect(page.getByText(text).filter({ visible: true })).toBeVisible();
  await expectNoSeriousViolations(page);

  await patientContext.close();
});
