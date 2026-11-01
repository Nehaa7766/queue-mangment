import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { RECEPTION_STATE } from "./auth-state";

// Patient and reception chat (docs/MESSAGING.md "Screens"), against the
// seeded demo clinic. The patient joins General from their own client
// address, so these joins don't use up the other specs' rate limit.
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

async function hasNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// A signed-out patient in their own browser, waiting in General.
async function joinAsPatient(browser: Browser, name: string, address: number) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { "x-forwarded-for": `10.0.1.${address}` },
  });
  const page = await context.newPage();
  await page.goto("/q/demo-clinic");
  await page.getByRole("link", { name: /General/ }).click();
  await page.getByLabel(/First name or initials/).fill(name);
  await page.getByRole("button", { name: "Join queue" }).click();
  await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
  const label = (await page.getByTestId("token-label").textContent())!.trim();
  // Chats open on their own screen from the token page's Messages card.
  await page
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("link", { name: /^Reception/ })
    .click();
  await expect(page).toHaveURL(/\/messages\?with=reception$/);
  return { context, page, label };
}

test("patient and reception chat privately, with live replies and Seen", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );

  const name = `E2E Chat ${Date.now().toString(36)}`;
  const patient = await joinAsPatient(browser, name, 10);

  // The patient writes first.
  const card = patient.page.getByRole("region", {
    name: "Messages",
    exact: true,
  });
  await expect(
    card.getByText(
      "For questions about your visit. Not for medical emergencies.",
    ),
  ).toBeVisible();
  const question = `Is it long? ${Date.now().toString(36)}`;
  await card.getByRole("textbox", { name: "Your message" }).fill(question);
  await card.getByRole("button", { name: "Send" }).click();
  const sent = card.getByRole("listitem").filter({ hasText: question });
  await expect(sent).toContainText("Sent");
  await expectNoSeriousViolations(patient.page);

  // Reception finds the chat by token, opens it and replies.
  await page.goto("/receptionist/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search chats" })
    .fill(patient.label);
  await page
    .getByRole("list", { name: "Chats" })
    .getByRole("link")
    .filter({ hasText: question })
    .click();
  await expect(page).toHaveURL(/\/receptionist\/messages\?c=[0-9a-f-]+$/);
  const chat = page.getByRole("region", { name: "Conversation" });
  await expect(chat.getByRole("heading", { level: 2 })).toContainText(name);
  await expect(
    chat.getByRole("listitem").filter({ hasText: question }),
  ).toBeVisible();

  // Opening it is a read: the patient sees Seen without reloading.
  await expect(sent).toContainText("Seen");

  const reply = `About 15 minutes ${Date.now().toString(36)}`;
  await chat.getByRole("textbox", { name: "Message", exact: true }).fill(reply);
  await chat
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  const replyRow = chat.getByRole("listitem").filter({ hasText: reply });
  await expect(replyRow).toContainText("Sent");
  await expectNoSeriousViolations(page);

  // The reply reaches the open token page live, and reading it shows Seen.
  await patient.page.bringToFront();
  // (List items, not the text: the screen-reader live region repeats it.)
  await expect(
    card.getByRole("listitem").filter({ hasText: reply }),
  ).toBeVisible();
  await expect(replyRow).toContainText("Seen");

  // The chat survives a refresh of the staff page through the URL.
  await page.bringToFront();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Conversation" })
      .getByRole("listitem")
      .filter({ hasText: reply }),
  ).toBeVisible();

  await patient.context.close();
});

test("Message on a live queue row opens that patient's chat", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );

  const name = `E2E Msg ${Date.now().toString(36)}`;
  const patient = await joinAsPatient(browser, name, 11);

  await page.goto("/receptionist/queue");
  await page
    .getByRole("navigation", { name: "Services" })
    .getByRole("link", { name: /General/ })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^Message ${name}`) })
    .click();

  await expect(page).toHaveURL(/\/receptionist\/messages\?c=[0-9a-f-]+$/);
  const chat = page.getByRole("region", { name: "Conversation" });
  await expect(chat.getByText("No messages yet")).toBeVisible();
  await chat
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello from the desk");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(
    chat.getByRole("listitem").filter({ hasText: "Hello from the desk" }),
  ).toContainText(/Sent|Seen/);

  // The patient sees it in their Reception chat.
  await patient.page.bringToFront();
  await expect(
    patient.page
      .getByRole("region", { name: "Messages", exact: true })
      .getByRole("listitem")
      .filter({ hasText: "Hello from the desk" }),
  ).toBeVisible();

  await patient.context.close();
});

test("Messages fits phones: the list, then the chat with a way back", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390", "Checks the phone layout");

  await page.goto("/receptionist/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", level: 1 }),
  ).toBeVisible();
  await hasNoHorizontalScroll(page);

  const first = page.getByRole("list", { name: "Chats" }).getByRole("link");
  // Earlier specs leave chats behind; without any there is nothing to open.
  if ((await first.count()) === 0) return;
  await first.first().click();
  await expect(page).toHaveURL(/\?c=/);
  await expect(page.getByRole("list", { name: "Chats" })).toBeHidden();
  await hasNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Back to chats" }).click();
  await expect(page.getByRole("list", { name: "Chats" })).toBeVisible();
});
