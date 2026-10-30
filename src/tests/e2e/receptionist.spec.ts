import { expect, test } from "@playwright/test";
import { RECEPTION_STATE } from "./auth-state";

// Signed in as the seeded receptionist by auth.setup.ts. The flow uses the
// Dental queue so it doesn't call tokens that the patient spec creates in General.
test.use({ storageState: RECEPTION_STATE });

test("receptionist registers a walk-in, then calls, recalls and skips them", async ({
  page,
}, testInfo) => {
  // One project only: the projects run in parallel and share the queue.
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );

  await page.goto("/receptionist/queue");
  await page
    .getByRole("navigation", { name: "Services" })
    .getByRole("link", { name: /Dental/ })
    .click();
  await expect(page).toHaveURL(/queue=/);

  // Walk-in from the drawer.
  const name = `E2E ${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "Walk-in" }).click();
  const drawer = page.getByRole("dialog", { name: "Register walk-in" });
  await drawer.getByLabel("Patient name").fill(name);
  await drawer.getByRole("button", { name: "Register walk-in" }).click();
  const created = page.getByText(
    new RegExp(`Token C-\\d+ created for ${name}`),
  );
  await expect(created).toBeVisible();
  const label = (await created.textContent())!.match(/C-\d+/)![0];

  // Call next until our walk-in is on the ticket (older Dental tokens may be ahead).
  const ticket = page.getByRole("region", { name: "Now serving" });
  const callNext = page.getByRole("button", { name: /Call next/ });
  for (let attempt = 0; attempt < 20; attempt++) {
    if ((await ticket.textContent())?.includes(label)) break;
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/call-next")),
      callNext.click(),
    ]);
  }
  await expect(ticket).toContainText(label);
  await expect(ticket).toContainText(name);
  await expect(ticket).toContainText("Called");

  // Recall restarts the grace period and counts the recall.
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/recall")),
    ticket.getByRole("button", { name: "Recall" }).click(),
  ]);
  await expect(ticket).toContainText("recalled 1×");

  // Skip asks for confirmation, then lists the token as a no-show.
  await ticket.getByRole("button", { name: "Skip" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(`Skip ${label}?`);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/skip")),
    confirm.getByRole("button", { name: "Skip patient" }).click(),
  ]);
  const recent = page.getByRole("region", { name: "Recently finished" });
  await expect(
    recent.getByRole("listitem").filter({ hasText: label }),
  ).toContainText("No-show");
});

test("reception navigation fits the screen", async ({ page }, testInfo) => {
  await page.goto("/receptionist");
  const nav = page.getByRole("navigation", { name: "Main" });

  if (testInfo.project.name === "phone-390") {
    // Bottom tabs with the raised Walk-in button.
    await expect(
      nav.getByRole("link", { name: "Register walk-in" }),
    ).toBeVisible();
    await nav.getByRole("link", { name: "Queue" }).click();
  } else {
    await nav.getByRole("link", { name: "Live queue" }).click();
  }
  await expect(page).toHaveURL(/\/receptionist\/queue/);
  await expect(page.getByRole("heading", { name: "Live queue" })).toBeVisible();

  // No horizontal scrolling at any width.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
