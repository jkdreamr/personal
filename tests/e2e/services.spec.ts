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

test.describe("Starting points (modes)", () => {
  test("a common-use chip fills the goal with a natural sentence, then the chips step aside", async ({ page }) => {
    await page.goto("/research");
    const goal = page.getByRole("textbox", { name: "What do you want to understand?" });
    await expect(goal).toHaveValue("");
    // The quiet "Common uses" row is offered on the empty screen.
    await expect(page.getByText("Common uses:")).toBeVisible();
    await page.getByRole("button", { name: "Competitor scan" }).click();
    // It prefills a real sentence the user can edit — not a bare label.
    await expect(goal).toHaveValue(/competitors/i);
    // Once there's a goal, the starting-point chips are no longer in the way.
    await expect(page.getByText("Common uses:")).toHaveCount(0);
  });
});

test.describe("Intelligence + Create services (demo mode)", () => {
  test("Present: build, navigate, edit a slide, add/delete with undo, and present-mode keyboard", async ({ page }) => {
    await page.goto("/present");
    await page.getByRole("textbox").first().fill("A short investor deck: our product helps teams ship migrations faster and safer.");
    await page.getByRole("button", { name: "Build presentation" }).click();
    await expect(page.getByRole("heading", { name: "Slides" })).toBeVisible();

    // Navigator + count.
    const navButtons = page.getByRole("navigation", { name: "Slides" }).getByRole("button");
    const n = await navButtons.count();
    expect(n).toBeGreaterThan(0);
    await expect(page.getByText(/\d+ slides/)).toBeVisible();

    // Click-to-edit the current slide's title → reflected in the navigator.
    await page.getByRole("textbox", { name: "Slide title" }).fill("EDITEDTITLE");
    await expect(page.getByRole("navigation", { name: "Slides" }).getByRole("button", { name: /Slide 1: EDITEDTITLE/ })).toBeVisible();

    // Add a slide → count grows; delete → shrinks; undo restores.
    await page.getByRole("button", { name: "Add slide" }).click();
    await expect(navButtons).toHaveCount(n + 1);
    await page.getByRole("button", { name: "Delete slide" }).click();
    await expect(navButtons).toHaveCount(n);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(navButtons).toHaveCount(n + 1);

    // Present mode: opens, arrow keys navigate, Escape exits.
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Exit presentation" })).toHaveCount(0);
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
