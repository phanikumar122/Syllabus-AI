import { test, expect } from "@playwright/test";
test("landing preview switches subjects and views using accessible text controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Preview Mathematics", exact: true })
    .click();
  await expect(page.locator(".saas-preview")).toContainText("Differentiation");
  await page
    .getByRole("button", { name: "Topic progress", exact: true })
    .click();
  await expect(page.locator(".preview-topic-list")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Topic progress", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Weekly plan", exact: true }).click();
  await expect(page.locator(".preview-plan-list")).toBeVisible();
  await expect(page.locator(".saas-site svg.lucide")).toHaveCount(0);
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/premium-landing-desktop.png",
    fullPage: true,
  });
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/premium-landing-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/premium-landing-mobile.png",
    fullPage: true,
  });
});

test("reduced motion keeps navigation and dialogs usable on a small phone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the dashboard", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator(".workspace-page-transition")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.001);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Study Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/premium-workspace-mobile.png",
    fullPage: true,
  });
});
