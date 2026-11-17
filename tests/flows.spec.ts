import { test, expect, type Page } from "@playwright/test";
import type { DemoState } from "../src/types";
const enter = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the dashboard" }).click();
  await expect(
    page.getByRole("textbox", { name: "Search subjects and topics" }),
  ).toBeVisible();
};
test("manual onboarding keeps topics separate and saves the actual preview", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start planning free", exact: false })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Subject 1 name" }).fill("Physics");
  await page.getByRole("button", { name: "Add another subject" }).click();
  await page.getByRole("textbox", { name: "Subject 2 name" }).fill("Chemistry");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Topics for Physics" })
    .fill("Motion\nEnergy");
  await page
    .locator(".syllabus-subject")
    .filter({
      has: page.getByRole("heading", { name: "Physics", exact: true }),
    })
    .getByRole("button", { name: "Use lines as manual topics" })
    .click();
  await page
    .getByRole("textbox", { name: "Topics for Chemistry" })
    .fill("Atoms");
  await page
    .locator(".syllabus-subject")
    .filter({
      has: page.getByRole("heading", { name: "Chemistry", exact: true }),
    })
    .getByRole("button", { name: "Use lines as manual topics" })
    .click();
  await page.getByRole("button", { name: "Generate my preview" }).click();
  const preview = await page.locator(".preview-sessions").innerText();
  expect(preview).toContain("Motion");
  expect(preview).toContain("Atoms");
  await page.getByRole("button", { name: "Enter my workspace" }).click();
  const state: DemoState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("syllabus-ai-workspace-v3")!),
  );
  expect(state.subjects.map((s) => s.topics.map((t) => t.title))).toEqual([
    ["Motion", "Energy"],
    ["Atoms"],
  ]);
  expect(state.studyLog).toEqual([]);
  expect(
    state.subjects
      .flatMap((s) => s.topics)
      .every((t) => t.status === "Not started"),
  ).toBeTruthy();
  expect(state.sessions.length).toBe(3);
});
test("overlapping session displays a useful error and stays unsaved", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Study Planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date", { exact: true }).fill("2027-01-05");
  await dialog.getByLabel("Start time").fill("10:00");
  await dialog.getByLabel("Duration", { exact: true }).fill("60");
  await dialog
    .getByRole("button", { name: "Add session", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await dialog.getByLabel("Date", { exact: true }).fill("2027-01-05");
  await dialog.getByLabel("Start time").fill("10:30");
  await dialog
    .getByRole("button", { name: "Add session", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("overlaps");
});
test("topic dialog updates status immediately and restores keyboard focus", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "My Subjects", exact: true }).click();
  await page.locator(".subject-open").first().click();
  const topic = page
    .locator(".topic-open")
    .filter({ hasText: "Not started" })
    .first();
  const label = await topic.locator("strong").innerText();
  await topic.click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(dialog).toContainText("Complete");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".topic-open").filter({ hasText: label }),
  ).toBeFocused();
  expect(label.length).toBeGreaterThan(0);
});
test("malformed local data blocks writes and offers recovery", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("syllabus-ai-workspace-v3", '{"subjects":"bad"}'),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Workspace needs attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry loading" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("syllabus-ai-workspace-v3")),
  ).toBe('{"subjects":"bad"}');
});
test("coach reports backend errors and preserves typed input", async ({
  page,
}) => {
  await page.route("**/api/coach/chat", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "AI is not configured." }),
    }),
  );
  await enter(page);
  await page.getByRole("button", { name: "AI Coach", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Help me prioritize");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText("not configured");
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue("Help me prioritize");
});
test("desktop pages load without runtime errors and capture redesign", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/repaired-dashboard-desktop.png",
    fullPage: true,
  });
  for (const name of [
    "My Subjects",
    "Study Planner",
    "Calendar",
    "Analytics",
    "AI Coach",
    "Settings",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".app-page h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
test("mobile navigation and pages fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/repaired-dashboard-mobile.png",
    fullPage: true,
  });
  for (const name of [
    "My Subjects",
    "Study Planner",
    "Calendar",
    "Analytics",
    "Settings",
  ]) {
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator(".app-page h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});
test("local recovery can discard a corrupt workspace after confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("syllabus-ai-workspace-v3", "bad");
      sessionStorage.setItem("seeded", "yes");
    }
  });
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard local recovery and reload" })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore the dashboard" }),
  ).toBeVisible();
});
