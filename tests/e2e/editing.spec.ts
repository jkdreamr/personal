import { test, expect } from "@playwright/test";

test.describe("Editing + regenerate on every tool (demo mode)", () => {
  test("a generated result is editable with the cursor-style editor and can regenerate", async ({ page }) => {
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief my partner on the Acme deal: status, the main risks, and next steps.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Regenerate is available.
    await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();

    // Enter edit mode → the shared Composer (with Continue / Improve) appears.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Improve selection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

    // The editor is a real editable surface.
    const editor = page.getByPlaceholder(/Edit freely/);
    await expect(editor).toBeVisible();
    await editor.fill("My own edited brief content for the partner.");
    await expect(page.getByText(/\d+ words/)).toBeVisible();
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
