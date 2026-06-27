import { test, expect } from "@playwright/test";

async function pasteText(page: import("@playwright/test").Page, text: string) {
  await page.getByRole("button", { name: "Paste text" }).first().click();
  await page.getByPlaceholder("Paste here…").fill(text);
  await page.getByRole("button", { name: "Add text" }).click();
}

test.describe("Existing-draft entry (demo mode)", () => {
  test("paste a draft and improve it instead of starting from scratch (Notes)", async ({ page }) => {
    await page.goto("/notes");
    // Switch to the draft start-state.
    await page.getByRole("tab", { name: "I already have a draft" }).click();
    const draft = page.getByRole("textbox", { name: "Your draft" });
    await expect(draft).toBeVisible();
    await draft.fill("PROJECTALPHA shipped the new editor. Risk: the timeline slipped a week. Next: tell the team on Friday.");
    // The CTA is service-specific.
    await page.getByRole("button", { name: "Organize my notes" }).click();
    // The result is built from the user's own draft.
    const result = page.locator("article.print-document");
    await expect(result).toBeVisible();
    await expect(result).toContainText(/PROJECTALPHA|timeline|Friday/i);
  });

  test("draft entry is not offered for analysis services (Verify)", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByRole("tab", { name: "I already have a draft" })).toHaveCount(0);
  });
});

test.describe("Intelligence + Create services (demo mode)", () => {
  test("Present builds a slide deck preview with a Present button", async ({ page }) => {
    await page.goto("/present");
    await page.getByRole("textbox").first().fill("A short investor deck: our product helps teams ship migrations faster and safer.");
    await page.getByRole("button", { name: "Build presentation" }).click();

    await expect(page.getByRole("heading", { name: "Slides" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Present" })).toBeVisible();
    await expect(page.getByText(/slides/i).first()).toBeVisible();
  });

  test("Compare renders a comparison table", async ({ page }) => {
    await page.goto("/compare");
    await page.getByRole("textbox").first().fill("Compare these two vendors.");
    await pasteText(page, "Vendor A: $10k, fast setup, limited support.");
    await pasteText(page, "Vendor B: $14k, slower setup, excellent support.");
    await page.getByRole("button", { name: "Compare" }).click();

    await expect(page.getByRole("heading", { name: "Comparison" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
    // (scope to the visible panel; a hidden print-only appendix duplicates this text)
    await expect(page.getByText(/What matters most here: cost/).filter({ visible: true })).toBeVisible();
  });

  test("Challenge labels every point with a classification", async ({ page }) => {
    await page.goto("/challenge");
    await page.getByRole("textbox").first().fill("Pressure-test this thesis: the market will double next year and we will capture half of it.");
    await page.getByRole("button", { name: "Find risks" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Evidence is collapsed by default — open the summary, then check the labels.
    await page.getByRole("button", { name: /Based on/ }).click();
    // At least one classification label is shown (color is never the only signal).
    await expect(
      page.getByText(/Unresolved question|Reported claim|Opinion|Not sufficiently supported/).filter({ visible: true }).first()
    ).toBeVisible();
  });

  test("Research shows a user-provided source and coverage note", async ({ page }) => {
    await page.goto("/research");
    await page.getByRole("textbox").first().fill("Understand this company from the notes.");
    await pasteText(page, "Acme builds data-migration tooling for mid-market software teams. Founded 2019.");
    await page.getByRole("button", { name: "Research" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Open the collapsed evidence summary, then confirm a user-provided source is shown.
    await page.getByRole("button", { name: /Based on/ }).click();
    await expect(page.getByText("You provided this").filter({ visible: true }).first()).toBeVisible();
  });

  test("Explain shows the non-advice disclaimer", async ({ page }) => {
    await page.goto("/explain");
    await page
      .getByRole("textbox")
      .first()
      .fill("Explain this notice: policy renews 2026-08-01, premium $2,340 due within 30 days, $45 late fee after due date.");
    await page.getByRole("button", { name: "Explain" }).click();

    await expect(page.getByText(/not legal, medical, tax, or financial advice/i)).toBeVisible();
  });
});
