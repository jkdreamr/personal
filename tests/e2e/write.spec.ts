import { test, expect } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Write (demo mode)", () => {
  test("produces a draft, copies, and exports markdown", async ({ page }) => {
    await page.goto("/write");
    await expect(page.getByRole("heading", { name: "What do you need to write?" })).toBeVisible();

    await page
      .getByRole("textbox")
      .first()
      .fill("Draft a short, warm follow-up email to Dana confirming the March start and next steps.");
    await page.getByRole("button", { name: "Create draft" }).click();

    // Real result appears with the demo label and an editable artifact.
    await expect(page.getByText("Demo example", { exact: false })).toBeVisible();
    await expect(page.locator("article.print-document")).toBeVisible();
    const copyBtn = page.getByRole("button", { name: "Copy", exact: true });
    await expect(copyBtn).toBeVisible();

    // Copy → clean text
    await copyBtn.click();
    await page.getByRole("button", { name: "Copy clean text" }).click();
    await expect(page.getByText("Clean text copied to clipboard.", { exact: true })).toBeVisible();

    // Export → Markdown triggers a real download with a clean filename.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /Markdown/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^harbor-draft-.*\.md$/);
  });

  test("refinement chips re-run and keep the workspace", async ({ page }) => {
    await page.goto("/write");
    await page.getByRole("textbox").first().fill("Write a concise internal memo about moving the launch to April.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    await page.getByRole("button", { name: "Make it shorter" }).click();
    // Still shows a result (no crash, work preserved).
    await expect(page.locator("article.print-document")).toBeVisible();
  });
});
