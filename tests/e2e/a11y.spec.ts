import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Accessibility checks on key screens. We fail on serious/critical WCAG 2 A/AA issues. */
async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("Accessibility (axe)", () => {
  test("access page has no serious/critical violations", async ({ page }) => {
    await page.goto("/access");
    const v = await scan(page);
    expect(v, JSON.stringify(v.map((x) => x.id), null, 2)).toEqual([]);
  });

  test("home page has no serious/critical violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are you working on?" })).toBeVisible();
    const v = await scan(page);
    expect(v, JSON.stringify(v.map((x) => x.id), null, 2)).toEqual([]);
  });

  test("workspace with a result has no serious/critical violations", async ({ page }) => {
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief my partner on where the Acme deal stands and the key risks to watch.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();
    const v = await scan(page);
    expect(v, JSON.stringify(v.map((x) => x.id), null, 2)).toEqual([]);
  });
});
