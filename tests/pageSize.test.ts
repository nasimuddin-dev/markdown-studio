import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { resolvePageSize } from "../src/services/convert/pageSize";
import { markdownToDocx } from "../src/services/convert/toDocx";
import { markdownToPdf } from "../src/services/convert/toPdf";
import { sanitizeSettings } from "../src/stores/settingsStore";

describe("export page size", () => {
  it("follows the region of the system language when automatic", () => {
    expect(resolvePageSize("auto", "en-US")).toBe("letter");
    expect(resolvePageSize("auto", "fr-CA")).toBe("letter");
    expect(resolvePageSize("auto", "es-MX")).toBe("letter");
    expect(resolvePageSize("auto", "en-GB")).toBe("a4");
    expect(resolvePageSize("auto", "de-DE")).toBe("a4");
    expect(resolvePageSize("auto", "en")).toBe("a4");
    expect(resolvePageSize("auto", undefined)).toBe("a4");
    expect(resolvePageSize("auto", "not a locale!")).toBe("a4");
  });

  it("uses an explicit choice as is", () => {
    expect(resolvePageSize("a4", "en-US")).toBe("a4");
    expect(resolvePageSize("letter", "de-DE")).toBe("letter");
  });

  it("sets the Word page size in twips", async () => {
    const xml = async (pageSize: "a4" | "letter") =>
      (await JSZip.loadAsync(await markdownToDocx("# Hi", { pageSize }))).file("word/document.xml")!.async("string");
    expect(await xml("letter")).toMatch(/<w:pgSz[^>]*w:w="12240"[^>]*w:h="15840"/);
    expect(await xml("a4")).toMatch(/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
  });

  it("sets the PDF page size in points", async () => {
    const box = async (pageSize: "a4" | "letter") =>
      new TextDecoder("latin1").decode(await markdownToPdf("# Hi", { pageSize })).match(/\/MediaBox\s*\[([^\]]+)\]/)![1].trim().split(/\s+/).map(Number);
    expect(await box("letter")).toEqual([0, 0, 612, 792]);
    const a4 = await box("a4");
    expect(a4[2]).toBeCloseTo(595.28, 1);
    expect(a4[3]).toBeCloseTo(841.89, 1);
  }, 30_000);

  it("keeps only valid values in settings", () => {
    expect(sanitizeSettings({ exportPageSize: "letter" }).exportPageSize).toBe("letter");
    expect(sanitizeSettings({ exportPageSize: "tabloid" }).exportPageSize).toBe("auto");
  });
});
