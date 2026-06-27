import { test, expect } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Write studio (demo mode)", () => {
  test("auto-writes a streamed draft, copies, and exports markdown", async ({ page }) => {
    await page.goto("/write");
    await expect(page.getByLabel("What are you writing?")).toBeVisible();

    await page.getByLabel("What are you writing?").fill("A short, warm follow-up to Dana confirming the March start.");
    await page.getByRole("button", { name: "Write it for me" }).click();

    // The draft streams, then commits into the rich document editor.
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await expect(editor).toContainText(/Demo draft|March start/i, { timeout: 15000 });

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
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("In conclusion, we leverage robust holistic synergy to unlock game-changing value.");
    // Local style hints appear without a model call.
    await expect(page.getByRole("button", { name: /suggestion/ })).toBeVisible({ timeout: 6000 });
  });

  test("rich formatting via toolbar and keyboard shortcuts", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("A bold idea");
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Bold" }).click();
    await expect(editor.locator("strong")).toHaveText("A bold idea");

    // Bulleted list via the toolbar.
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Bulleted list" }).click();
    await expect(editor.locator("ul li")).toHaveCount(1);
  });

  test("draft persists across a refresh", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("My own sentence that should survive a reload.");
    await expect(page).toHaveURL(/\/write\?task=/, { timeout: 5000 });
    await page.waitForTimeout(900); // let autosave flush
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Document editor" })).toContainText(/should survive a reload/, { timeout: 8000 });
  });
});
