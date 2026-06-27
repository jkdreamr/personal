import { test, expect } from "@playwright/test";

test.describe("Resilience", () => {
  test("provider failure shows a plain-language error and Retry, preserving work", async ({ page }) => {
    // Intercept the task stream and return an error line on the first attempt only.
    let calls = 0;
    await page.route("**/api/task", async (route) => {
      calls++;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body:
            JSON.stringify({ type: "stage", stage: { id: "received", label: "Context received", state: "done" } }) +
            "\n" +
            JSON.stringify({ type: "error", message: "Harbor could not complete this task right now because the free research model is temporarily unavailable. Your work is still saved here." }) +
            "\n",
        });
      } else {
        await route.continue(); // second attempt hits the real demo engine
      }
    });

    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief the team on the schedule change for next week and the main risks.");
    await page.getByRole("button", { name: "Create brief" }).click();

    // Error surfaces with recovery, work preserved (goal still in context).
    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    // Retry succeeds against the real demo engine.
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();
  });

  test("mobile bottom navigation is present and usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    // Bottom nav items.
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await page.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library/);
  });

  test("empty input cannot start a task", async ({ page }) => {
    await page.goto("/brief");
    await expect(page.getByRole("button", { name: "Create brief" })).toBeDisabled();
  });
});
