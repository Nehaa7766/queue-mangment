import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { RECEPTION_STATE } from "./auth-state";

// The end-to-end scenario docs/MESSAGING.md calls mandatory: one announcement
// reaches two patients privately, each reply stays in its own chat, and a
// patient who drops off the network gets the missed message once on return.
test.use({ storageState: RECEPTION_STATE });

const run = Date.now().toString(36);

type Patient = {
  page: Page;
  label: string;
  publicTokenId: string;
  close: () => Promise<void>;
};

// A signed-out patient on their own phone, waiting in General. Each gets its
// own client address so the joins don't share a rate-limit bucket.
async function join(
  browser: Browser,
  name: string,
  address: number,
): Promise<Patient> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { "x-forwarded-for": `10.0.2.${address}` },
  });
  const page = await context.newPage();
  await page.goto("/q/demo-clinic");
  await page.getByRole("link", { name: /General/ }).click();
  await page.getByLabel(/First name or initials/).fill(name);
  await page.getByRole("button", { name: "Join queue" }).click();
  await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
  const label = (await page.getByTestId("token-label").textContent())!.trim();
  const publicTokenId = new URL(page.url()).pathname.split("/").at(-1)!;
  // Chats open on their own screen from the token page's Messages card.
  await page
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("link", { name: /^Reception/ })
    .click();
  await expect(page).toHaveURL(/\/messages\?with=reception$/);
  return { page, label, publicTokenId, close: () => context.close() };
}

function patientChat(patient: Patient): Locator {
  return patient.page.getByRole("region", { name: "Messages", exact: true });
}

// Message rows, not text: screen-reader live regions repeat new messages.
function rows(scope: Locator, text: string): Locator {
  return scope.getByRole("listitem").filter({ hasText: text });
}

test("announcement to A and B, private replies, and catch-up after going offline", async ({
  page,
  browser,
}, testInfo) => {
  // Sign-in and announcements are rate-limited, so this runs once.
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );
  test.setTimeout(90_000);

  const a = await join(browser, `E2E A ${run}`, 21);
  const b = await join(browser, `E2E B ${run}`, 22);

  // 1. Reception sends one announcement to General.
  const announcement = `Doctor delayed 15 min ${run}`;
  await page.goto("/receptionist/announcements");
  await page.getByRole("button", { name: "New announcement" }).click();
  const sheet = page.getByRole("dialog", { name: "New announcement" });
  await sheet.getByRole("textbox", { name: "Message" }).fill(announcement);
  await sheet.getByText("Chosen services", { exact: true }).click();
  await sheet.getByRole("checkbox", { name: /General/ }).check();
  await sheet.getByRole("button", { name: "Send announcement" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Send to [\d,]+ patients?$/ })
    .click();
  await expect(page.getByText(/All [\d,]+ patients? handled\./)).toBeVisible({
    timeout: 20_000,
  });

  // 2–3. Both patients get it, each in their own reception chat.
  await expect(rows(patientChat(a), announcement)).toHaveCount(1);
  await expect(rows(patientChat(b), announcement)).toHaveCount(1);

  // 4. A replies.
  const aReply = `A asks: can I step out? ${run}`;
  await patientChat(a)
    .getByRole("textbox", { name: "Your message" })
    .fill(aReply);
  await patientChat(a).getByRole("button", { name: "Send" }).click();
  await expect(rows(patientChat(a), aReply)).toContainText("Sent");

  // 5. Staff sees A's reply in A's chat.
  await page.goto("/receptionist/messages");
  await page.getByRole("searchbox", { name: "Search chats" }).fill(a.label);
  await page
    .getByRole("list", { name: "Chats" })
    .getByRole("link")
    .filter({ hasText: aReply })
    .click();
  await expect(page).toHaveURL(/\?c=[0-9a-f-]+$/);
  const aConversationId = new URL(page.url()).searchParams.get("c")!;
  const staffChat = page.getByRole("region", { name: "Conversation" });
  await expect(rows(staffChat, aReply)).toBeVisible();
  await expect(rows(staffChat, announcement)).toBeVisible();

  // 6. B never sees A's reply, even after a reload.
  await b.page.reload();
  await expect(rows(patientChat(b), announcement)).toHaveCount(1);
  await expect(patientChat(b)).not.toContainText(aReply);

  // 7. B cannot reach A's chat: staff endpoints need a staff session, and
  // B's own link only returns B's chat.
  const asB = b.page.request;
  // (Paths from MESSAGING_API in src/features/messaging/contracts.ts; the
  // E2E image only has the tests, not the app source.)
  const staffRead = await asB.get(
    `/api/messages/conversations/${aConversationId}/messages`,
  );
  expect([401, 403, 404]).toContain(staffRead.status());
  const own = await asB.get(
    `/api/public/tokens/${b.publicTokenId}/messages/reception`,
  );
  expect(own.status()).toBe(200);
  const ownBodies = (
    (await own.json()) as { messages: { body: string }[] }
  ).messages.map((m) => m.body);
  expect(ownBodies).toContain(announcement);
  expect(ownBodies).not.toContain(aReply);

  // 8. Staff replies privately to A; B doesn't get it.
  const privateReply = `Yes, 10 minutes is fine ${run}`;
  const composer = staffChat.getByRole("textbox", {
    name: "Message",
    exact: true,
  });
  await composer.fill(privateReply);
  await composer.press("Enter");
  await expect(rows(patientChat(a), privateReply)).toHaveCount(1);
  await expect(rows(staffChat, privateReply)).toContainText("Seen");
  await b.page.reload();
  await expect(rows(patientChat(b), announcement)).toHaveCount(1);
  await expect(patientChat(b)).not.toContainText(privateReply);

  // 9–10. A drops off the network; staff sends again. Nobody has read it.
  await a.page.context().setOffline(true);
  const missed = `Please come back now ${run}`;
  await composer.fill(missed);
  await composer.press("Enter");
  await expect(rows(staffChat, missed)).toContainText("Sent");
  await page.waitForTimeout(2_000);
  await expect(rows(staffChat, missed)).not.toContainText("Seen");

  // 11–13. A comes back: the missed message arrives once, without a reload.
  await a.page.context().setOffline(false);
  await expect(rows(patientChat(a), missed)).toHaveCount(1, {
    timeout: 20_000,
  });
  await expect(rows(patientChat(a), privateReply)).toHaveCount(1);
  await expect(rows(patientChat(a), announcement)).toHaveCount(1);

  // 14. Seen follows real reads: A has now opened it.
  await expect(rows(staffChat, missed)).toContainText("Seen", {
    timeout: 20_000,
  });

  await a.close();
  await b.close();
});
