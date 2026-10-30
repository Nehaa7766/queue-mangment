import { expect, test } from "@playwright/test";
import { clientAddress } from "./auth-state";

// Own client address for the sign-in and slug-check rate limits (auth-state.ts).
test.use(clientAddress(60));

// Seeded super admin and demo clinic (prisma/seed.sql). The test database must
// be migrated and seeded before this runs.
const SUPER_ADMIN_EMAIL = "superadmin@queuecare.test";
const PASSWORD = "queuecare-dev";

test("super admin adds and views a clinic, adds a second admin, then edits and deletes the clinic", async ({
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
  const nav = page.getByRole("navigation", { name: "Main" });
  // The billing screens were removed.
  await expect(
    nav.getByRole("link", { name: /Plans|Subscriptions|Billing/ }),
  ).toHaveCount(0);

  await nav.getByRole("link", { name: "Clinics" }).click();
  await page.getByRole("link", { name: "View Demo Clinic" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Clinic" }),
  ).toBeVisible();
  await expect(page.getByText("Contact and location")).toBeVisible();

  // A new clinic has no patient history, so it can be deleted again. The
  // delete also removes its pending invitations; nothing is left behind.
  const run = Date.now().toString(36);
  const name = `E2E Clinic ${run}`;
  const slug = `e2e-clinic-${run}`;
  const renamed = `E2E Renamed ${run}`;

  await test.step("add a clinic", async () => {
    await page.goto("/super-admin/clinics");
    await page.getByRole("button", { name: "Add clinic" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a clinic" });
    await sheet.getByLabel("Clinic name").fill(name);
    await expect(sheet.getByLabel("Public address")).toHaveValue(slug);
    await expect(sheet.getByText(`/q/${slug} is available.`)).toBeVisible();
    await sheet.getByLabel("Clinic type").selectOption("DENTAL");
    await sheet.getByLabel("City (optional)").fill("Pune");
    // Hours keep their defaults: Mon–Sat, 09:00–18:00.
    await sheet.getByLabel("Name", { exact: true }).fill("E2E Admin");
    await sheet
      .getByLabel("Email", { exact: true })
      .fill(`${slug}@example.test`);
    await sheet.getByRole("button", { name: "Add clinic" }).click();

    const added = page.getByRole("dialog", { name: "Clinic added" });
    await expect(added.getByLabel("Invitation link")).toHaveValue(
      /\/accept-invite\//,
    );
    await added.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });

  await test.step("view it", async () => {
    await page.getByRole("link", { name: `View ${name}` }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Dental", { exact: true })).toBeVisible();
    await expect(page.getByText("Mon–Sat · 09:00–18:00")).toBeVisible();
    await expect(page.getByText("Pune", { exact: true })).toBeVisible();
    await page.goto("/super-admin/clinics");
  });

  await test.step("rename it", async () => {
    await page.getByRole("button", { name: `Edit ${name}` }).click();
    const sheet = page.getByRole("dialog", { name: `Edit ${name}` });
    await sheet.getByLabel("Clinic name").fill(renamed);
    await sheet.getByRole("button", { name: "Save changes" }).click();
    await expect(sheet).toBeHidden();
    await expect(
      page.getByRole("link", { name: renamed, exact: true }),
    ).toBeVisible();
  });

  await test.step("users: one super admin, tabs and icon actions", async () => {
    await page.goto("/super-admin/users");
    await expect(page.getByText(/Signed in as Sam Platform/)).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "User lists" });
    await expect(
      tabs.getByRole("link", { name: /Clinic admins/ }),
    ).toHaveAttribute("aria-current", "page");

    // The super admin is never a row; clinic admins are, with icon actions.
    await expect(
      page.getByRole("button", { name: "Edit Sam Platform" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit Asha Admin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send password reset to Asha Admin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Deactivate Asha Admin" }),
    ).toBeVisible();
    const blockedDelete = page.getByRole("button", {
      name: "Delete Asha Admin",
    });
    await expect(blockedDelete).toBeDisabled();
    await expect(blockedDelete).toHaveAccessibleDescription(
      /Deactivate instead/,
    );

    await tabs.getByRole("link", { name: /Clinic staff/ }).click();
    await expect(page).toHaveURL(/tab=staff/);
    await expect(
      page.getByRole("button", { name: "Edit Neha Reception" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit Asha Admin" }),
    ).toHaveCount(0);
  });

  await test.step("add a second admin to the new clinic", async () => {
    await page.getByRole("button", { name: "Add admin" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a clinic admin" });
    await sheet
      .getByLabel("Clinic", { exact: true })
      .selectOption({ label: renamed });
    await sheet.getByLabel("Name", { exact: true }).fill("E2E Second Admin");
    await sheet
      .getByLabel("Email", { exact: true })
      .fill(`${slug}-second@example.test`);
    await sheet.getByRole("button", { name: "Add admin" }).click();

    const added = page.getByRole("dialog", { name: "Admin added" });
    await expect(added.getByLabel("Invitation link")).toHaveValue(
      /\/accept-invite\//,
    );
    await added.getByRole("button", { name: "Done" }).click();
    await expect(added).toBeHidden();
  });

  await test.step("view a user: profile, clinic access and actions", async () => {
    await page.goto("/super-admin/users");
    await page.getByRole("link", { name: "View Asha Admin" }).click();
    await expect(
      page.getByRole("heading", { name: "Asha Admin" }),
    ).toBeVisible();
    await expect(page.getByText("admin@demo-clinic.test")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Demo Clinic", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Recent actions")).toBeVisible();
    // The same icon actions as on the Users page.
    await expect(
      page.getByRole("button", { name: "Edit Asha Admin" }),
    ).toBeVisible();
  });

  await test.step("delete it, typing its address to confirm", async () => {
    await page.goto("/super-admin/clinics");
    await page.getByRole("button", { name: `Delete ${renamed}` }).click();
    const dialog = page.getByRole("alertdialog", {
      name: `Delete ${renamed}?`,
    });
    const confirm = dialog.getByRole("button", { name: "Delete permanently" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill(slug);
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("link", { name: renamed, exact: true }),
    ).toHaveCount(0);
  });
  await test.step("the activity log pages, clamping a page past the end", async () => {
    await page.goto("/super-admin/activity?page=999");
    const pager = page.getByRole("navigation", { name: "Pagination" });
    await expect(pager.getByText(/^Showing \d+–\d+ of \d+$/)).toBeVisible();
    // Clamped to the last page, so there is never a page after it.
    await expect(pager.getByRole("link", { name: "Next page" })).toHaveCount(0);
  });
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
