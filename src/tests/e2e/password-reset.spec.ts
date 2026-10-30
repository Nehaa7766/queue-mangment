import { expect, test } from "@playwright/test";
import { clientAddress } from "./auth-state";

// Own client address for the sign-in rate limit (auth-state.ts).
test.use(clientAddress(4));

// Requests that reach Better Auth run at one width only: reset requests are
// limited per IP, and every E2E browser shares one IP. No email is sent here;
// the request only records an outbox event.
function serverRequestOnce(projectName: string) {
  test.skip(projectName !== "desktop-1280", "Runs once, at desktop width");
}

test("sign-in links to password reset", async ({ page }) => {
  await page.goto("/login");

  // Shown as "Forgot?" with " password" for screen readers only; Chromium
  // adds a space after that hidden span, so the name may read "password ?".
  await page.getByRole("link", { name: /^Forgot password ?\?$/ }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});

test("an invalid email is caught before sending", async ({ page }) => {
  await page.goto("/forgot-password");

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("a reset request gives the same answer for any email", async ({
  page,
}, testInfo) => {
  serverRequestOnce(testInfo.project.name);
  await page.goto("/forgot-password");

  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(/If an account uses that email/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toBeVisible();
});

test("the reset page explains a missing link", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(
    page.getByText(/This reset link is invalid or has expired/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get a new link" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("a made-up token is rejected", async ({ page }, testInfo) => {
  serverRequestOnce(testInfo.project.name);
  await page.goto("/reset-password?token=made-up-token");

  await page.getByLabel("New password", { exact: true }).fill("a-new-password");
  await page.getByLabel("Confirm new password").fill("a-new-password");
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(
    page.getByText(/This reset link is invalid or has expired/),
  ).toBeVisible();
});
