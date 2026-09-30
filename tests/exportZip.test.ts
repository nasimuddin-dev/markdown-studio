import { describe, expect, it } from "vitest";
import { planZipImages } from "../src/features/exportZip";

describe("Markdown with images as a .zip", () => {
  it("moves local pictures into images/ with unique names, and leaves web images and documents alone", () => {
    const text = [
      "![Logo](assets/logo.png) and again ![Logo](./assets/logo.png)",
      "![Other](../shared/logo.png) ![Space](<my pics/a b.jpg>)",
      "![Web](https://example.com/x.png) [doc](guide.md)",
      '<img src="assets/diagram.svg" alt="D">',
      "",
      "[ref]: assets/chart.webp",
    ].join("\n");
    const plan = planZipImages(text, "/ws/docs/page.md");
    expect(plan.text).toBe(
      [
        "![Logo](images/logo.png) and again ![Logo](images/logo.png)",
        "![Other](images/logo-2.png) ![Space](<images/a b.jpg>)",
        "![Web](https://example.com/x.png) [doc](guide.md)",
        '<img src="images/diagram.svg" alt="D">',
        "",
        "[ref]: images/chart.webp",
      ].join("\n"),
    );
    expect(plan.images).toEqual([
      { name: "logo.png", path: "/ws/docs/assets/logo.png" },
      { name: "logo-2.png", path: "/ws/shared/logo.png" },
      { name: "a b.jpg", path: "/ws/docs/my pics/a b.jpg" },
      { name: "diagram.svg", path: "/ws/docs/assets/diagram.svg" },
      { name: "chart.webp", path: "/ws/docs/assets/chart.webp" },
    ]);
  });
});
