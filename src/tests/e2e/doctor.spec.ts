import { expect, test, type Page } from "@playwright/test";
import { clientAddress, RECEPTION_STATE } from "./auth-state";

// Own client address for the sign-in rate limit (auth-state.ts).
test.use(clientAddress(3));

// Runs against the seeded demo clinic (prisma/seed.sql). Uses the Pediatrics
// queue so it doesn't call tokens the patient (General) or reception (Dental)
// specs create. The seeded doctor has no service assignments, so they see
// every service.

const DOCTOR_EMAIL = "doctor@demo-clinic.test";
const PASSWORD = "queuecare-dev";

async function hasNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("reception calls a patient, the doctor starts and completes the visit, and the patient sees Done", async ({
  browser,
  page,
}, testInfo) => {
  // Sign-in is limited to 5 attempts a minute per IP, so the doctor signs in
  // once, at one width; smaller widths are checked by resizing below.
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Runs once, at desktop width",
  );

  // 1. The patient joins Pediatrics.
  const patientName = `Doc E2E ${Date.now().toString(36)}`;
  await page.goto("/q/demo-clinic");
  await page.getByRole("link", { name: /Pediatrics/ }).click();
  await page.getByLabel(/First name or initials/).fill(patientName);
  await page.getByRole("button", { name: "Join queue" }).click();
  await expect(page).toHaveURL(/\/token\/[0-9a-f-]+$/);
  const label = (await page.getByTestId("token-label").textContent())!.trim();
  expect(label).toMatch(/^B-\d+$/);

  // 2. Reception calls until our patient is on the ticket.
  const reception = await browser.newContext({ storageState: RECEPTION_STATE });
  const desk = await reception.newPage();
  await desk.goto("/receptionist/queue");
  await desk
    .getByRole("navigation", { name: "Services" })
    .getByRole("link", { name: /Pediatrics/ })
    .click();
  await expect(desk).toHaveURL(/queue=/);
  const ticket = desk.getByRole("region", { name: "Now serving" });
  const callNext = desk.getByRole("button", { name: /Call next/ });
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await ticket.textContent())?.includes(label)) break;
    await Promise.all([
      desk.waitForResponse((response) => response.url().includes("/call-next")),
      callNext.click(),
    ]);
  }
  await expect(ticket).toContainText(label);
  await reception.close();

  // 3. The doctor signs in and starts our patient.
  const doctorContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const doctor = await doctorContext.newPage();
  await doctor.goto("/login");
  await doctor.getByLabel("Email").fill(DOCTOR_EMAIL);
  await doctor.getByLabel("Password").fill(PASSWORD);
  await doctor.getByRole("button", { name: "Open my counter" }).click();
  await expect(doctor).toHaveURL(/\/doctor$/);

  await doctor.goto("/doctor/consultation");
  // Finish a consultation an earlier run may have left open.
  const leftover = doctor.getByRole("button", {
    name: /Complete consultation/,
  });
  if (await leftover.isVisible()) {
    await Promise.all([
      doctor.waitForResponse((response) =>
        response.url().endsWith("/complete"),
      ),
      leftover.click(),
    ]);
  }

  await Promise.all([
    doctor.waitForResponse((response) => response.url().endsWith("/start")),
    doctor
      .getByRole("button", {
        name: new RegExp(`^Start consultation with ${label},`),
      })
      .click(),
  ]);
  const consultation = doctor.getByRole("region", {
    name: "Current consultation",
  });
  await expect(consultation).toContainText(label);
  await expect(consultation).toContainText(patientName);

  // 4. The doctor completes the visit.
  await Promise.all([
    doctor.waitForResponse((response) => response.url().endsWith("/complete")),
    consultation.getByRole("button", { name: /Complete consultation/ }).click(),
  ]);
  await expect(doctor.getByText(/No consultation in progress/)).toBeVisible();

  // 5. The patient's page shows the visit as done.
  await page.reload();
  await expect(
    page.getByText("Visit completed", { exact: true }),
  ).toBeVisible();

  // The doctor's pages fit phone and tablet widths too.
  for (const width of [390, 834]) {
    await doctor.setViewportSize({ width, height: 844 });
    for (const path of ["/doctor", "/doctor/queue", "/doctor/availability"]) {
      await doctor.goto(path);
      await expect(doctor.getByRole("heading", { level: 1 })).toBeVisible();
      await hasNoHorizontalScroll(doctor);
    }
  }
  await doctorContext.close();
});
