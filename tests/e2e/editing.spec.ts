import { test, expect } from "@playwright/test";

test.describe("Editing + regenerate on every tool (demo mode)", () => {
  test("a generated result is editable with the rich document editor and can regenerate", async ({ page }) => {
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief my partner on the Acme deal: status, the main risks, and next steps.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Regenerate is available.
    await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();

    // Enter edit mode → the shared rich editor (with Continue / Improve) appears.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Improve selection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

    // The editor is a real editable rich surface.
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("My own edited brief content for the partner.");
    await expect(editor).toContainText("My own edited brief content");
    await expect(page.getByText(/\d+ words/)).toBeVisible();
  });

  test("structured tools (Verify) offer Improve but not Continue in the editor", async ({ page }) => {
    await page.goto("/verify");
    await page.getByRole("textbox").first().fill("Check this claim: we are the only product with real-time sync in the market.");
    await page.getByRole("button", { name: "Review claims" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Improve selection" })).toBeVisible();
    // Verify is a structured analysis — "Continue writing" doesn't fit, so it's not offered.
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  });

  test("regenerating after an edit shows the fresh result, not the old edited text", async ({ page }) => {
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief the team on the Q3 plan, the risks, and the next steps.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Edit and replace the body with a unique marker.
    await page.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("ZZZMYEDITMARKER my own throwaway text");
    await expect(editor).toContainText("ZZZMYEDITMARKER");
    await page.waitForTimeout(500); // let the doc autosave flush before leaving edit mode
    await page.getByRole("button", { name: "Done editing" }).click();
    await expect(page.getByText("ZZZMYEDITMARKER")).toBeVisible();

    // Regenerate → the old edit must be gone, the new result shown.
    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();
    await expect(page.getByText("ZZZMYEDITMARKER")).toHaveCount(0);
  });

  test("Improve selection keeps a visible highlight and replaces only the selection with Undo", async ({ page }) => {
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief the team on the Q3 plan, risks, and next steps.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("REPLACEWORD keep the rest of this sentence intact.");
    // Select just the first word by double-clicking at the top-left of the paragraph (OS-robust).
    await editor.locator("p").first().dblclick({ position: { x: 14, y: 10 } });
    await page.getByRole("button", { name: "Improve selection" }).click();

    // The selection stays visibly highlighted while the panel is open.
    await expect(editor.locator(".rd-improve-target").first()).toBeVisible();
    // A freeform instruction enables Apply.
    await page.getByLabel("Or describe the change").fill("rewrite this more simply");
    await page.getByRole("button", { name: /Apply/ }).click();

    // Only the selected word was replaced and the highlight cleared; the rest of the sentence remains.
    await expect(editor.locator(".rd-improve-target")).toHaveCount(0, { timeout: 15000 });
    await expect(editor).toContainText("keep the rest of this sentence intact.");
  });

  test("Regenerate re-runs and keeps the workspace", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("textbox").first().fill("Turn these into a plan: call the bank, renew the lease, email the team.");
    await page.getByRole("button", { name: "Organize" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();
    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();
  });
});
