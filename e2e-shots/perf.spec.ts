/**
 * Time to first display of a large pasted document (local measurement, not CI):
 *   npx playwright test -c e2e-shots/playwright.config.ts perf
 * The same 800 KB text is shown section by section, and (with a footnote
 * appended, which keeps the single pass) parsed as a whole.
 */
import { expect, test, type Page } from "@playwright/test";

function sampleDoc(targetBytes: number) {
  const section = (i: number) => `## Section ${i}

Some **bold** text, a [link](https://example.com/${i}), \`code\`, and a #tag here. More words follow to make a paragraph of typical length, with *emphasis* and an emoji :tada:.

- Item one with text
- [ ] A task

| A | B |
| - | - |
| ${i} | x |

\`\`\`ts
const x${i} = ${i};
\`\`\`
`;
  let s = "# Big document\n\n";
  for (let i = 0; s.length < targetBytes; i++) s += section(i);
  return s;
}

async function timeToFirstDisplay(page: Page, text: string): Promise<number> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible();
  return page.evaluate(async (doc) => {
    // The dev server's module (a variable, so TypeScript doesn't try to resolve it).
    const modulePath = "/src/features/documents.ts";
    const { newDocument } = await import(/* @vite-ignore */ modulePath);
    const started = performance.now();
    newDocument(doc);
    await new Promise<void>((resolve) => {
      const check = () => (document.querySelector(".markdown-body h1") ? resolve() : requestAnimationFrame(check));
      check();
    });
    return performance.now() - started;
  }, text);
}

test("a large document appears quickly", async ({ page }) => {
  test.setTimeout(120_000);
  const doc = sampleDoc(800_000);
  const sectioned = await timeToFirstDisplay(page, doc);
  const whole = await timeToFirstDisplay(page, doc + "\nA note.[^1]\n\n[^1]: Keeps the single pass.\n");
  console.log(`800 KB document: first display ${Math.round(sectioned)} ms section by section, ${Math.round(whole)} ms as a whole`);
  expect(sectioned).toBeLessThan(whole);
});
