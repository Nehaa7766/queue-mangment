import { expect, test as setup } from "@playwright/test";
import { clientAddress, RECEPTION_STATE } from "./auth-state";

// Signs in once and saves the session for the reception specs.
setup.use(clientAddress(1));

setup("sign in as the seeded receptionist", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("reception@demo-clinic.test");
  await page.getByLabel("Password").fill("queuecare-dev");
  await page.getByRole("button", { name: "Open my counter" }).click();
  await expect(page).toHaveURL(/\/receptionist$/);

  await page.context().storageState({ path: RECEPTION_STATE });
});
