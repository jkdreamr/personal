import { test, expect } from "@playwright/test";

test.describe("Access gate", () => {
  test("access page renders and the form submits into the app", async ({ page }) => {
    await page.goto("/access");
    await expect(page.getByRole("heading", { name: "Harbor" })).toBeVisible();
    await expect(page.getByText("Private beta")).toBeVisible();

    await page.getByLabel("Access code").fill("test-code");
    await page.getByRole("button", { name: "Enter" }).click();

    // Lands in the app (gate disabled in test env, so any code passes through to home).
    await expect(page.getByRole("heading", { name: "What are you working on?" })).toBeVisible();
  });
});
