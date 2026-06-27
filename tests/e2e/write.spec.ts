import { test, expect } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Write studio (demo mode)", () => {
  test("auto-writes a streamed draft, copies, and exports markdown", async ({ page }) => {
    await page.goto("/write");
    await expect(page.getByLabel("What are you writing?")).toBeVisible();

    await page.getByLabel("What are you writing?").fill("A short, warm follow-up to Dana confirming the March start.");
    await page.getByRole("button", { name: "Write it for me" }).click();

    // The draft streams into the editor.
    const editor = page.getByPlaceholder(/Start writing/);
    await expect(editor).toHaveValue(/Demo draft|March start/i, { timeout: 15000 });

    // Copy the draft.
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText("Copied to clipboard.", { exact: true })).toBeVisible();

    // Export markdown → real download.
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /Markdown/ }).click();
    expect((await dl).suggestedFilename()).toMatch(/^harbor-draft-.*\.md$/);
  });

  test("typing surfaces live editorial hints", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByPlaceholder(/Start writing/);
    await editor.fill("In conclusion, we leverage robust holistic synergy to unlock game-changing value.");
    // Local style hints appear without a model call.
    await expect(page.getByRole("button", { name: /suggestion/ })).toBeVisible({ timeout: 5000 });
  });

  test("draft persists across a refresh", async ({ page }) => {
    await page.goto("/write");
    await page.getByPlaceholder(/Start writing/).fill("My own sentence that should survive a reload.");
    await expect(page).toHaveURL(/\/write\?task=/, { timeout: 5000 });
    await page.waitForTimeout(800); // let autosave flush
    await page.reload();
    await expect(page.getByPlaceholder(/Start writing/)).toHaveValue(/should survive a reload/);
  });
});
