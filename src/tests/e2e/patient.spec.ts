import { expect, test, type Page, type Request } from "@playwright/test";

// Runs against the seeded demo clinic (prisma/seed.sql): slug demo-clinic,
// General (A), Pediatrics (B) and Dental (C), no opening hours set.

const JOIN_ENDPOINT = /^\/api\/queues\/[^/]+\/tokens$/;

function recordJoinRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      JOIN_ENDPOINT.test(new URL(request.url()).pathname)
    ) {
      requests.push(request);
    }
  });
  return requests;
}

async function openGeneralConfirmation(page: Page) {
  await page.goto("/q/demo-clinic");
  await expect(
    page.getByRole("heading", { name: "Demo Clinic" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /General/ }).click();
  await expect(page).toHaveURL(/\/q\/demo-clinic\/join\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "Join the queue" }),
  ).toBeVisible();
}

async function joinGeneral(page: Page) {
  await openGeneralConfirmation(page);
  await page.getByLabel(/First name or initials/).fill("E2E");
  await page.getByRole("button", { name: "Join queue" }).click();
  await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
}

test("patient joins the General queue and sees their token", async ({
  page,
}) => {
  await joinGeneral(page);

  await expect(page.getByTestId("token-label")).toHaveText(/^A-\d+$/);
  await expect(page.getByText("Waiting", { exact: true })).toBeVisible();
  await expect(page.getByText(/Updated just now/)).toBeVisible();
});

test("browsing the clinic and choosing a service never creates a token", async ({
  page,
}) => {
  const joinRequests = recordJoinRequests(page);

  await openGeneralConfirmation(page);
  await page.getByRole("link", { name: "Back to services" }).click();
  await expect(page).toHaveURL(/\/q\/demo-clinic$/);

  expect(joinRequests).toHaveLength(0);
});

test("double-clicking Join queue creates only one token", async ({ page }) => {
  await openGeneralConfirmation(page);
  const joinRequests = recordJoinRequests(page);

  await page.getByRole("button", { name: "Join queue" }).dblclick();

  await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
  expect(joinRequests).toHaveLength(1);
});

test("patient can leave the queue after confirming", async ({ page }) => {
  await joinGeneral(page);

  await page.getByRole("button", { name: "Leave the queue" }).click();
  await page.getByRole("button", { name: "Leave queue" }).click();

  await expect(
    page.getByText("You've left the queue", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
});

test("unknown clinic shows a friendly not found message", async ({ page }) => {
  await page.goto("/q/no-such-clinic");

  await expect(
    page.getByRole("heading", { name: "We couldn't find this clinic" }),
  ).toBeVisible();
});

test("unknown token shows a friendly not found message", async ({ page }) => {
  await page.goto("/token/00000000-0000-4000-8000-000000000000");

  await expect(
    page.getByRole("heading", { name: "We couldn't find this token" }),
  ).toBeVisible();
});
