import { test, expect, type Page } from "@playwright/test";

async function expectNeoSurface(page: Page, selector: string) {
  const panels = page.locator(selector);
  for (const part of selector.split(",")) {
    await expect(page.locator(part.trim()).first()).toBeAttached();
  }
  for (const panel of await panels.all()) {
    const style = await panel.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        blur: computed.backdropFilter,
        background: computed.backgroundColor,
        radius: computed.borderTopLeftRadius,
        border: Math.max(
          ...[
            computed.borderTopWidth,
            computed.borderRightWidth,
            computed.borderBottomWidth,
            computed.borderLeftWidth,
          ].map(parseFloat),
        ),
      };
    });
    expect(style.blur).toBe("none");
    expect(parseFloat(style.radius)).toBeLessThanOrEqual(2);
    expect(style.border).toBeGreaterThanOrEqual(2);
    const alpha = Number(
      style.background.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? 1,
    );
    expect(alpha).toBe(1);
  }
}

test("neobrutal theme covers the public page and every workspace view", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expectNeoSurface(
    page,
    ".saas-header, .saas-preview, .saas-feature-grid article, .saas-start, .saas-faq, .saas-footer",
  );
  await page.screenshot({
    path: "output/playwright/neo-landing.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Explore the dashboard", exact: true })
    .click();
  await expectNeoSurface(
    page,
    ".app-sidebar, .app-topbar, .dashboard-focus-card, .metrics-grid, .surface-card",
  );
  await page.screenshot({
    path: "output/playwright/neo-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const [name, selector, slug] of [
    ["My Subjects", ".subject-card", "subjects"],
    ["Study Planner", ".planner-toolbar, .planner-day", "planner"],
    ["Calendar", ".calendar-grid", "calendar"],
    ["Analytics", ".surface-card, .metrics-grid", "analytics"],
    ["AI Coach", ".surface-card", "coach"],
    ["Settings", ".surface-card", "settings"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expectNeoSurface(page, selector);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `output/playwright/neo-${slug}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page
    .getByRole("button", { name: "Study Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await expectNeoSurface(page, ".modal-card");
  await page.screenshot({
    path: "output/playwright/neo-dialog.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expectNeoSurface(page, ".mobile-navigation");
  await page.screenshot({
    path: "output/playwright/neo-mobile-nav.png",
    animations: "disabled",
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expectNeoSurface(page, ".surface-card");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "output/playwright/neo-mobile-settings.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("onboarding uses the requested black and green palette with readable controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".saas-site")).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(15, 17, 8)");
  expect(
    await page
      .locator(".button-primary")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(39, 251, 107)");
  const contrast = await page
    .locator(".button-primary")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const values = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const a = luminance(style.color),
        b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page
    .getByRole("button", { name: "Start planning free", exact: true })
    .click();
  await expectNeoSurface(page, ".onboarding-topbar, .onboarding-card");
  await page.screenshot({
    path: "output/playwright/neo-onboarding.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("textbox", { name: "Subject 1 name", exact: true })
    .fill("Physics");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Topics for Physics", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/neo-mobile-onboarding.png",
    fullPage: true,
    animations: "disabled",
  });
});
