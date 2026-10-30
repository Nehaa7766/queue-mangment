import { expect, test } from "@playwright/test";
import { clientAddress } from "./auth-state";

// Own client address for the sign-in rate limit (auth-state.ts).
test.use(clientAddress(2));

// Uses the seeded reception account (prisma/seed.sql). The test database
// must be migrated and seeded before this runs.
const RECEPTION_EMAIL = "reception@demo-clinic.test";
const PASSWORD = "queuecare-dev";

// Real sign-in attempts run at one width only: sign-in is limited to
// 5 attempts a minute per IP, and every E2E browser shares one IP.
function signInOnce(projectName: string) {
  test.skip(projectName !== "desktop-1280", "Sign-in runs once, at desktop");
}

test("staff sign in and land on their role's home page", async ({
  page,
}, testInfo) => {
  signInOnce(testInfo.project.name);
  await page.goto("/login");

  await page.getByLabel("Email").fill(RECEPTION_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/receptionist$/);
});

test("a wrong password shows an error and stays on sign-in", async ({
  page,
}, testInfo) => {
  signInOnce(testInfo.project.name);
  await page.goto("/login");

  await page.getByLabel("Email").fill(RECEPTION_EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("empty fields show inline errors", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
});

test("staff pages redirect to sign-in without a session", async ({ page }) => {
  await page.goto("/receptionist");

  await expect(page).toHaveURL(/\/login$/);
});
