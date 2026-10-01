import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoBackend } from "../src/services/memoryBackend";

describe("browser demo without prompt()", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the default answer where prompt() isn't supported", async () => {
    vi.spyOn(window, "prompt").mockImplementation(() => {
      throw new Error("prompt() is not supported.");
    });
    const demo = createDemoBackend();
    expect(await demo.pickOpenFile()).toBe("/demo/README.md");
  });
});
