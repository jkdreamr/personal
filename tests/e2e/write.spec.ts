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

  test("cursor-anchored autocomplete: ghost appears mid-writing, Tab accepts, Esc dismisses", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("Here is a quick note to the whole team and");
    // A grey ghost suggestion appears at the caret (demo provides a deterministic continuation).
    await expect(editor.locator(".rd-ghost-text")).toBeVisible({ timeout: 6000 });
    // Tab accepts it.
    await page.keyboard.press("Tab");
    await expect(editor).toContainText("what we should do next.");
    await expect(editor.locator(".rd-ghost-text")).toHaveCount(0);
    // Type more; a fresh suggestion appears, and Escape dismisses it without inserting.
    await page.keyboard.type(" We should align on the timing for");
    await expect(editor.locator(".rd-ghost-text")).toBeVisible({ timeout: 6000 });
    await page.keyboard.press("Escape");
    await expect(editor.locator(".rd-ghost-text")).toHaveCount(0);
  });

  test("Tab indents a list when no suggestion is showing", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.getByRole("button", { name: "Bulleted list" }).click();
    await page.keyboard.type("one"); // short text → no autocomplete fetch
    await page.keyboard.press("Enter");
    await page.keyboard.type("two");
    await page.keyboard.press("Tab"); // with no ghost, Tab indents (nested list)
    await expect(editor.locator("ul ul")).toHaveCount(1);
  });

  test("typing $...$ and $$...$$ renders math (KaTeX), invalid degrades gracefully", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    // Inline math, mid-line.
    await page.keyboard.type("Euler ");
    await page.keyboard.type("$e^{i\\pi}+1=0$");
    await expect(editor.locator(".katex").first()).toBeVisible({ timeout: 4000 });
    await expect(editor).not.toContainText("$e^{i"); // the literal $...$ was converted
    // Display math on its own line.
    await page.keyboard.press("Enter");
    await page.keyboard.type("$$\\int_0^1 x\\,dx$$");
    await expect(editor.locator(".katex")).toHaveCount(2, { timeout: 4000 });
    // Invalid LaTeX must not crash the editor (KaTeX throwOnError:false renders, editor stays usable).
    await page.keyboard.press("Enter");
    await page.keyboard.type("$\\frac{1}{$");
    await page.keyboard.type(" still typing");
    await expect(editor).toContainText("still typing");
  });

  test("writing font selection applies and persists after refresh", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await page.getByLabel("Writing font").selectOption("serif");
    // The editor adopts the chosen serif stack.
    await expect(editor).toHaveCSS("font-family", /Iowan|Palatino|Georgia/);
    await page.waitForTimeout(400); // let the preference persist
    await page.reload();
    await expect(page.getByLabel("Writing font")).toHaveValue("serif");
    await expect(page.getByRole("textbox", { name: "Document editor" })).toHaveCSS("font-family", /Iowan|Palatino|Georgia/);
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
