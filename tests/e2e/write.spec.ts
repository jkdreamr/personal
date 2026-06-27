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

  test("cursor-anchored autocomplete: fires at a pause, Tab accepts, Esc dismisses", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    // Mid-word there is no suggestion (it must not nag while typing a word).
    await page.keyboard.type("Here is a quick note to the whole team an");
    await expect(editor.locator(".rd-ghost-text")).toHaveCount(0);
    // Finishing the word + a space is the natural pause where a suggestion appears.
    await page.keyboard.type("d ");
    await expect(editor.locator(".rd-ghost-text")).toBeVisible({ timeout: 6000 });
    // Tab accepts it.
    await page.keyboard.press("Tab");
    await expect(editor).toContainText("what we should do next.");
    await expect(editor.locator(".rd-ghost-text")).toHaveCount(0);
    // Type more, pause again; a fresh suggestion appears, and Escape dismisses it without inserting.
    await page.keyboard.type(" We should align on the timing for ");
    await expect(editor.locator(".rd-ghost-text")).toBeVisible({ timeout: 6000 });
    await page.keyboard.press("Escape");
    await expect(editor.locator(".rd-ghost-text")).toHaveCount(0);
  });

  test("Suggest: analyzes the draft, shows suggestions + inline markers, and accepts an exact patch", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("We will utilize a robust plan to leverage the team this quarter.");
    await page.getByRole("button", { name: "Suggest" }).click();

    // The suggestions panel opens with results (demo provides deterministic ones).
    await expect(page.getByRole("region", { name: "Editorial suggestions" })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: "utilize" }).first();
    await expect(card).toBeVisible({ timeout: 8000 });
    // The target is marked inline in the editor.
    await expect(editor.locator(".rd-suggestion").first()).toBeVisible();

    // Accept → the exact target is replaced; the rest of the sentence is untouched.
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(editor).not.toContainText("utilize");
    await expect(editor).toContainText("We will use a robust plan");

    // Dismiss another suggestion → it disappears from the panel.
    const robustCard = page.getByRole("listitem").filter({ hasText: "robust" }).first();
    await robustCard.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "robust" })).toHaveCount(0);
  });

  test("Suggest: a richer set of suggestions, and hovering a marker shows an accept card", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    // A draft with several distinct issues → the demo should surface many, not just one.
    await page.keyboard.type("We will utilize a robust plan to leverage synergy in order to drive game-changing results.");
    await page.getByRole("button", { name: "Suggest" }).click();
    await expect(page.getByRole("region", { name: "Editorial suggestions" })).toBeVisible();
    // More than a couple of suggestions (richer pass).
    await expect.poll(async () => editor.locator(".rd-suggestion").count(), { timeout: 8000 }).toBeGreaterThan(3);

    // Hover the first inline marker → a Grammarly-style card appears, anchored to it.
    const mark = editor.locator(".rd-suggestion").first();
    await mark.hover();
    const card = page.getByRole("dialog", { name: "Suggestion" });
    await expect(card).toBeVisible();
    // Accept from the card applies the exact patch.
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(card).toBeHidden();
    await expect(editor).not.toContainText("utilize");
  });

  test("Suggest: a repeated word is replaced at the right occurrence only", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    // "utilize" appears twice; the suggestion is anchored to the first by its before/after context.
    await page.keyboard.type("We utilize A and we utilize B.");
    await page.getByRole("button", { name: "Suggest" }).click();
    const card = page.getByRole("listitem").filter({ hasText: "utilize" }).first();
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.getByRole("button", { name: "Accept" }).click();
    // Exactly the first occurrence changed; the second is left untouched (never the wrong sentence).
    await expect(editor).toContainText("We use A and we utilize B.");
  });

  test("inline font: apply a font to just the selected text", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("Some words to restyle");
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Font for selected text" }).click();
    await page.getByRole("button", { name: "Serif", exact: true }).click();
    // A textStyle span carrying the serif font wraps the selection.
    const styled = editor.locator('span[style*="font-family"]');
    await expect(styled.first()).toBeVisible();
    await expect(styled.first()).toHaveCSS("font-family", /Iowan|Palatino|Georgia/);
  });

  test("shows the word count of the current selection", async ({ page }) => {
    await page.goto("/write");
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.type("alpha beta gamma delta");
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.getByText("4 of 4 words selected")).toBeVisible();
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
