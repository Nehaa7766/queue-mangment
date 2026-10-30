import { expect, test } from "@playwright/test";

test("home page shows the now serving ticket", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Clinic queue management" }),
  ).toBeVisible();
  const ticket = page.getByRole("region", { name: "Now serving" });
  await expect(ticket).toContainText("A-17");
  await expect(ticket.getByRole("button", { name: "Call next" })).toBeVisible();
});

test("health check reports the database as healthy", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-request-id"]).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("patients can open their clinic from the QR scanner by code", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Scan QR code" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Scan your clinic's QR code",
  });
  await expect(dialog).toBeVisible();
  // E2E runs over plain http, where browsers don't allow the camera, so the
  // scanner explains why and offers the typed code instead.
  await expect(
    dialog.getByText(/secure \(https\) page|No camera/),
  ).toBeVisible();

  await dialog.getByLabel("Or enter the clinic code").fill("not a code!");
  await dialog.getByRole("button", { name: "Open" }).click();
  await expect(dialog.getByText(/Enter the code printed/)).toBeVisible();

  await dialog.getByLabel("Or enter the clinic code").fill("demo-clinic");
  await dialog.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/q\/demo-clinic$/);
});
