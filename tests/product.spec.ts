import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the dashboard" }).click();
});
test("dashboard charts have visible space on desktop", async ({ page }) => {
  const chart = page.locator(".chart-wrap");
  await expect(chart).toBeVisible();
  expect((await chart.boundingBox())!.height).toBeGreaterThan(150);
});
test("invalid session cannot be saved", async ({ page }) => {
  await page
    .getByRole("button", { name: "Study Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Date", exact: true }).fill("");
  await dialog.getByRole("spinbutton", { name: /Duration/ }).fill("-30");
  await dialog
    .getByRole("button", { name: "Add session", exact: true })
    .click();
  await expect(dialog).toBeVisible();
});
test("Day view stays populated when advancing the week", async ({ page }) => {
  await page
    .getByRole("button", { name: "Study Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.locator(".planner-day")).toHaveCount(1);
});
test("search shortcut focuses workspace search", async ({ page }) => {
  await expect(
    page.getByRole("textbox", { name: "Search subjects and topics" }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Search subjects and topics" }),
  ).toBeFocused();
});

test("local account settings explain service requirements without requesting push permission", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connected account services" }),
  ).toBeVisible();
  await expect(page.locator(".account-services")).toContainText(
    "signed-in cloud account",
  );
  await expect(
    page.getByRole("button", { name: "Subscribe securely with Stripe" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/account-services-desktop.png",
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
    path: "output/playwright/account-services-mobile.png",
    fullPage: true,
  });
});

test("background service worker installs and activates on localhost", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL;
  });
  expect(result).toBe("http://127.0.0.1:3000/sw.js");
});

test("workspace is dark only with text controls and retains legacy saved preferences", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("syllabus-ai-workspace-v3")!);
    state.preferences.theme = "light";
    localStorage.setItem("syllabus-ai-workspace-v3", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "Explore the dashboard" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app-frame svg.lucide")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Theme", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("syllabus-ai-workspace-v3")!)
          .preferences.theme,
    ),
  ).toBe("dark");
});
