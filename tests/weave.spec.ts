import { test, expect, type Page } from "@playwright/test";

async function trackGpuDraws(page: Page) {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElements;
    let draws = 0;
    WebGL2RenderingContext.prototype.drawElements = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof original>
    ) {
      document.documentElement.dataset.gpuDraws = String(++draws);
      return Reflect.apply(original, this, args);
    };
  });
}

test("custom WebGL sculpture animates, pauses, resizes and disposes on navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await trackGpuDraws(page);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const sculpture = page.locator(".syllabus-weave");
  await expect(sculpture).toHaveAttribute("data-status", "ready");
  expect(
    await sculpture.evaluate(
      (element) => getComputedStyle(element).backdropFilter,
    ),
  ).toBe("none");
  const canvas = sculpture.locator("canvas");
  const retainedCanvas = await canvas.elementHandle();
  const first = await canvas.screenshot({ animations: "disabled" });
  await page.waitForTimeout(750);
  expect(
    (await canvas.screenshot({ animations: "disabled" })).equals(first),
  ).toBeFalsy();
  await page.getByRole("button", { name: "Pause sculpture animation" }).click();
  await expect(sculpture).toHaveAttribute("data-motion", "paused");
  await page.waitForTimeout(200);
  const pausedDraws = await page.locator("html").getAttribute("data-gpu-draws");
  expect(Number(pausedDraws)).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(await page.locator("html").getAttribute("data-gpu-draws")).toBe(
    pausedDraws,
  );
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(canvas).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({
    path: "output/playwright/neo-weave-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "output/playwright/neo-weave-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Resume sculpture animation" })
    .click();
  await expect(sculpture).toHaveAttribute("data-motion", "playing");
  await page
    .getByRole("button", { name: "Explore the dashboard", exact: true })
    .click();
  await expect(sculpture).toHaveCount(0);
  expect(
    await retainedCanvas?.evaluate((element) =>
      (element as HTMLCanvasElement).getContext("webgl2")?.isContextLost(),
    ),
  ).toBeTruthy();
  await expect(page.locator(".app-sidebar")).toBeAttached();
  expect(
    await page
      .locator(".app-topbar")
      .evaluate((element) => getComputedStyle(element).backdropFilter),
  ).toBe("none");
  expect(errors).toEqual([]);
});

test("sculpture stops scheduling animation frames outside the viewport", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame;
    let frames = 0;
    window.requestAnimationFrame = (callback) =>
      original.call(window, (time) => {
        if (document.documentElement)
          document.documentElement.dataset.animationFrames = String(++frames);
        callback(time);
      });
  });
  await page.goto("/");
  await expect(page.locator(".syllabus-weave")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await page.waitForTimeout(400);
  expect(
    Number(await page.locator("html").getAttribute("data-animation-frames")),
  ).toBeGreaterThan(0);
  await page.locator(".saas-footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const before = await page
    .locator("html")
    .getAttribute("data-animation-frames");
  await page.waitForTimeout(350);
  expect(await page.locator("html").getAttribute("data-animation-frames")).toBe(
    before,
  );
  await page.locator(".syllabus-weave").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  expect(
    Number(await page.locator("html").getAttribute("data-animation-frames")),
  ).toBeGreaterThan(Number(before));
});

test("reduced motion renders a static sculpture and updates when the preference changes", async ({
  page,
}) => {
  await trackGpuDraws(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const sculpture = page.locator(".syllabus-weave");
  await expect(sculpture).toHaveAttribute("data-status", "ready");
  await expect(sculpture).toHaveAttribute("data-motion", "reduced");
  await expect(sculpture).toContainText("Motion reduced");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const first = await page.locator("html").getAttribute("data-gpu-draws");
  expect(Number(first)).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(await page.locator("html").getAttribute("data-gpu-draws")).toBe(first);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(
    page.getByRole("button", { name: "Pause sculpture animation" }),
  ).toBeVisible();
});

test("WebGL unavailable or context lost keeps a static artwork and working product controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".syllabus-weave")).toHaveAttribute(
    "data-status",
    "fallback",
  );
  await expect(page.locator(".weave-fallback")).toBeVisible();
  await page
    .getByRole("button", { name: "Preview Mathematics", exact: true })
    .click();
  await expect(page.locator(".saas-preview")).toContainText("Differentiation");
  await page
    .getByRole("button", { name: "Explore the dashboard", exact: true })
    .click();
  await expect(page.locator(".syllabus-weave")).toHaveCount(0);
});

test("lost GPU context falls back without crashing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".syllabus-weave")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await page.locator(".weave-canvas").evaluate((element) => {
    (element as HTMLCanvasElement)
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  });
  await expect(page.locator(".syllabus-weave")).toHaveAttribute(
    "data-status",
    "fallback",
  );
  await expect(page.locator(".weave-fallback")).toBeVisible();
  expect(errors).toEqual([]);
});
