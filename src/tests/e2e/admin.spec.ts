import { expect, test } from "@playwright/test";
import { clientAddress } from "./auth-state";

// Own client address for the sign-in rate limit (auth-state.ts).
test.use(clientAddress(70));

// Seeded clinic admin (prisma/seed.sql).
const EMAIL = "admin@demo-clinic.test";
const PASSWORD = "queuecare-dev";

// A fresh three-letter prefix, so reruns against the same database don't clash.
function randomPrefix(): string {
  return Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join("");
}

test("clinic admin adds a service patients can see, then changes the grace period", async ({
  page,
}, testInfo) => {
  // One project only: one sign-in, and the steps change shared demo data.
  test.skip(testInfo.project.name !== "desktop-1280", "Runs once, at desktop");

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();

  // Add a service.
  const name = `E2E ${Date.now().toString(36)}`;
  await page.goto("/admin/services");
  const add = page.getByRole("region", { name: "Add a service" });
  await add.getByLabel("Service name").fill(name);
  await add.getByLabel("Token prefix").fill(randomPrefix());
  await add.getByLabel("Minutes per patient").fill("5");
  await add.getByRole("button", { name: "Add service" }).click();
  const row = page
    .getByRole("region", { name: "Services", exact: true })
    .getByRole("listitem")
    .filter({ hasText: name });
  await expect(row).toContainText("Active");

  // Patients see it on the clinic page.
  await page.goto("/q/demo-clinic");
  await expect(page.getByText(name)).toBeVisible();

  // Turn it off again so the demo clinic stays tidy; its history is kept.
  await page.goto("/admin/services");
  await row.getByRole("button", { name: "Turn off" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Turn off" })
    .click();
  await expect(row).toContainText("Turned off");

  // Change the grace period and check it sticks.
  await page.goto("/admin/settings");
  const rules = page.getByRole("region", { name: "Queue rules" });
  const grace = rules.getByLabel("Grace period (minutes)");
  const original = await grace.inputValue();
  await grace.fill("4");
  await rules.getByRole("button", { name: "Save queue settings" }).click();
  await expect(page.getByText("Queue settings saved.")).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Queue rules" })
      .getByLabel("Grace period (minutes)"),
  ).toHaveValue("4");

  // Put it back for the other specs.
  await page
    .getByRole("region", { name: "Queue rules" })
    .getByLabel("Grace period (minutes)")
    .fill(original);
  await page
    .getByRole("region", { name: "Queue rules" })
    .getByRole("button", { name: "Save queue settings" })
    .click();
  await expect(page.getByText("Queue settings saved.").first()).toBeVisible();
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  // Signed out: the proxy sends admin pages to sign-in.
  await page.goto("/admin/services");
  await expect(page).toHaveURL(/\/login$/);
});
