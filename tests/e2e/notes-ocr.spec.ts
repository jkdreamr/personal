import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Notes — image / OCR correction flow", () => {
  test("uploads an image, shows the manual-correction editor, and uses the corrected text", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("textbox").first().fill("Organize these handwritten notes into a plan.");

    // Upload the fixture image. In demo mode OCR is skipped and routes to manual correction.
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "../fixtures/notes.png"));
    await expect(page.getByText("notes.png")).toBeVisible();

    await page.getByRole("button", { name: "Organize" }).click();

    // The context panel shows the image preview and a "confirm the text" editor.
    const ocrBox = page.locator('textarea[id^="att-"]');
    await expect(ocrBox).toBeVisible();
    await expect(page.locator('img[alt^="Preview of"]')).toBeVisible();

    // Correct the text, then re-run via a refinement.
    await ocrBox.fill("Call the bank Monday. Renew the passport by Friday. Book the venue.");
    await page.getByRole("button", { name: "Make it a plan" }).click();

    // The corrected text now drives the result (not the "add material" placeholder).
    await expect(page.locator("article.print-document").getByText(/Renew the passport/i).first()).toBeVisible();
  });
});
