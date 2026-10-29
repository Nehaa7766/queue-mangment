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
