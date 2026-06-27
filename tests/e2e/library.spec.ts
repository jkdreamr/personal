import { test, expect } from "@playwright/test";

test.describe("Library — save, restore, persist", () => {
  test("saved work appears in the Library and survives a refresh of the workspace", async ({ page }) => {
    // Create a result.
    await page.goto("/brief");
    await page.getByRole("textbox").first().fill("Brief my partner on where the Acme deal stands and the main risks.");
    await page.getByRole("button", { name: "Create brief" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // The URL now carries the task id (so a refresh restores it).
    await expect(page).toHaveURL(/\/brief\?task=/);
    await page.reload();
    await expect(page.locator("article.print-document")).toBeVisible(); // restored from IndexedDB

    // It shows up in the Library.
    await page.goto("/library");
    await expect(page.getByText("Brief my partner", { exact: false }).first()).toBeVisible();

    // And persists across a full Library reload.
    await page.reload();
    await expect(page.getByText("Brief my partner", { exact: false }).first()).toBeVisible();
  });

  test("delete offers undo", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("textbox").first().fill("Turn this into a checklist: water plants, pay rent, email Sam.");
    await page.getByRole("button", { name: "Organize" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    await page.goto("/library");
    const row = page.getByText("Turn this into a checklist", { exact: false }).first();
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).first().click();
    // The undo toast appears; click it and confirm the row is restored (robust against the
    // toast's auto-dismiss timing).
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(page.getByText("Turn this into a checklist", { exact: false }).first()).toBeVisible();
  });
});
