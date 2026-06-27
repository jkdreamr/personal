import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Notes — image / OCR view + correction flow", () => {
  test("uploads an image, opens it to view/correct the extracted text, and uses the corrected text", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("textbox").first().fill("Organize these handwritten notes into a plan.");

    // Upload the fixture image. In demo mode OCR is skipped (low confidence), prompting review.
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "../fixtures/notes.png"));
    await expect(page.getByText("notes.png")).toBeVisible();

    await page.getByRole("button", { name: "Organize" }).click();
    await expect(page.locator("article.print-document")).toBeVisible();

    // Click the attachment to open the viewer — the image preview + editable extracted text appear.
    await page.getByRole("button", { name: /View and edit notes\.png/ }).click();
    const ocrBox = page.locator("textarea#att-text");
    await expect(ocrBox).toBeVisible();
    await expect(page.locator('img[alt^="Preview of"]')).toBeVisible();

    // Correct the text and save → the context updates.
    await ocrBox.fill("Call the bank Monday. Renew the passport by Friday. Book the venue.");
    await page.getByRole("button", { name: "Save changes" }).click();

    // Re-run via a refinement → the corrected text now drives the result.
    await page.getByRole("button", { name: "Make it a plan" }).click();
    await expect(page.locator("article.print-document").getByText(/Renew the passport/i).first()).toBeVisible();
  });
});
