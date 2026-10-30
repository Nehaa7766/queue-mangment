import { expect, test } from "@playwright/test";
import { clientAddress } from "./auth-state";

// Own client address for the sign-in and slug-check rate limits (auth-state.ts).
test.use(clientAddress(60));

// Seeded super admin and demo clinic (prisma/seed.sql). The test database must
// be migrated and seeded before this runs.
const SUPER_ADMIN_EMAIL = "superadmin@queuecare.test";
const PASSWORD = "queuecare-dev";

test("super admin finds the demo clinic and opens its subscription", async ({
  page,
}, testInfo) => {
  // One sign-in per run is enough to cover the flow.
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Signs in once, at desktop",
  );

  // Sign in through the auth endpoint (auth.spec.ts covers the form). The
  // request shares the page's cookies.
  await page.goto("/login");
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email: SUPER_ADMIN_EMAIL, password: PASSWORD },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.ok()).toBe(true);

  await page.goto("/super-admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "Platform overview" }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Clinics" })
    .click();
  await page.getByRole("link", { name: "Demo Clinic" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Clinic" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Manage subscription" }).click();
  await expect(
    page.getByRole("heading", { name: "Subscription · Demo Clinic" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Plan", { exact: true }).locator("option:checked"),
  ).toHaveText(/Pilot/);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    /TRIALING|ACTIVE|PAST_DUE|CANCELLED/,
  );
});

test("platform pages send signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/super-admin/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("sign-up checks each step and spots a taken address", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Set up your clinic" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter the clinic's name.")).toBeVisible();

  // The seeded demo clinic already owns this address.
  await page.getByLabel("Clinic name").fill("Demo Clinic");
  await expect(page.getByLabel("Public address")).toHaveValue("demo-clinic");
  await expect(
    page.getByText("That address is taken. Try another."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Step 1 of 3: Clinic" }),
  ).toBeVisible();

  await page.getByLabel("Public address").fill("e2e-free-address-check");
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Step 2 of 3: First service" }),
  ).toBeVisible();

  // No horizontal scrolling at any width.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
