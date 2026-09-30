import { describe, expect, it } from "vitest";
import { imageAt } from "../src/features/imageHover";

describe("image under the pointer in the editor", () => {
  const text = 'See ![logo](assets/logo.png "Logo") and [doc](guide.md).\n\n[pic]: img/p.jpg?v=2\n\n<img src="a.svg" alt="A">';
  const at = (marker: string) => imageAt(text, text.indexOf(marker) + 1);

  it("finds image links, picture definitions and <img> tags", () => {
    expect(at("logo](")?.src).toBe("assets/logo.png");
    expect(at("img/p.jpg")?.src).toBe("img/p.jpg?v=2");
    expect(at("a.svg")?.src).toBe("a.svg");
  });

  it("ignores links to documents and plain text", () => {
    expect(at("doc](")).toBeNull();
    expect(at("See")).toBeNull();
  });
});
