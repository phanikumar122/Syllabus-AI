import { test, expect } from "@playwright/test";
test("cloud account settings save real controls and show provider delivery errors", async ({
  page,
}) => {
  let saved: unknown;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    expect(route.request().headers().authorization).toBe("Bearer browser-test");
    let body: unknown = {};
    let status = 200;
    if (path.endsWith("/account/services"))
      body = {
        billingConfigured: true,
        emailConfigured: true,
        pushConfigured: true,
        workerEnabled: false,
        billingRequired: false,
      };
    if (path.endsWith("/billing/status"))
      body = {
        configured: true,
        status: "active",
        premium: true,
        hasCustomer: true,
        price: { amount: 900, currency: "usd", interval: "month" },
      };
    if (path.endsWith("/notifications/preferences")) {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        body = { saved: true };
      } else
        body = {
          email: "learner@example.com",
          emailEnabled: false,
          digestEnabled: false,
          pushEnabled: false,
          timeZone: "Asia/Kolkata",
          leadMinutes: 15,
        };
    }
    if (path.endsWith("/notifications/test-email")) {
      status = 502;
      body = { error: "SMTP delivery failed. Retry later." };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/tests/fixtures/account-services.html");
  await expect(page.getByText("Status: active", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage subscription" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Subscribe securely with Stripe" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/reminder scheduler is not enabled/),
  ).toBeVisible();
  await page.getByLabel("Email before study sessions").check();
  await page.getByLabel("Weekly email digest on Monday").check();
  await page.getByLabel("Reminder lead time (minutes)").fill("30");
  await page.getByRole("button", { name: "Save delivery preferences" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  expect(saved).toEqual({
    emailEnabled: true,
    pushEnabled: false,
    digestEnabled: true,
    timeZone: "Asia/Kolkata",
    leadMinutes: 30,
  });
  await page.getByRole("button", { name: "Send test email to me" }).click();
  await expect(page.getByRole("alert")).toContainText("SMTP delivery failed");
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/cloud-services-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/cloud-services-mobile.png",
    fullPage: true,
  });
});

test("missing providers disable cloud delivery controls and explain billing availability", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/account/services")
      ? { emailConfigured: false, pushConfigured: false, workerEnabled: false }
      : path.endsWith("/billing/status")
        ? { configured: false, status: "free", price: null }
        : {
            emailEnabled: false,
            digestEnabled: false,
            pushEnabled: false,
            timeZone: "UTC",
            leadMinutes: 15,
          };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/tests/fixtures/account-services.html");
  await expect(page.getByLabel("Email before study sessions")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Enable this browser" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Billing is unavailable until Stripe is configured."),
  ).toBeVisible();
});
