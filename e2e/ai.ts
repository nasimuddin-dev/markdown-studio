import { expect, type Page } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";

/**
 * Gives the browser demo a stand-in AI (before the page loads): the demo has no
 * AI of its own, and tests must never call the real API.
 */
export async function withStandInAi(page: Page, answer = "A clearer, shorter version of the paragraph, written by the stand-in AI for this test.") {
  await page.addInitScript((text) => {
    (window as unknown as { __markpionE2eAi: () => Promise<string> }).__markpionE2eAi = async () => text;
  }, answer);
}

/** Turns AI commands on with a made-up key (kept by the demo's in-memory backend only). */
export async function turnOnAi(page: Page) {
  await page.keyboard.press(`${mod}+,`);
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("searchbox", { name: "Search settings" }).fill("AI");
  await settings.getByLabel(/Turn on AI commands/).check();
  await settings.getByLabel("Anthropic API key").fill("sk-ant-e2e-test-key");
  await settings.getByRole("button", { name: "Save Key" }).click();
  await expect(settings.getByLabel("Anthropic API key")).toHaveCount(0);
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(settings).toBeHidden();
}

/** Runs AI: Improve Writing on a new paragraph and waits for the review dialog with the answer. */
export async function openAiReview(page: Page) {
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("This paragraph are a bit long and it could be clearer if somebody rewrote it for the reader.");
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("AI: Improve Writing");
  await page.keyboard.press("Enter");
  // The first AI command asks before sending text anywhere.
  await page.getByRole("button", { name: "Continue" }).click();
  const review = page.getByRole("dialog", { name: "AI: Improve Writing" });
  await expect(review).toContainText("stand-in AI");
  await expect(review.getByRole("button", { name: /Replace|Apply|Insert/ }).last()).toBeEnabled();
  return review;
}
