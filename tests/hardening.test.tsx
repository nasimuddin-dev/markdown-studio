import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LruCache } from "../src/services/lruCache";
import { IMAGE_CACHE_BYTES, LARGE_DOCUMENT_CHARS } from "../src/services/limits";
import { lintsDocumentOf } from "../src/features/lintExtension";
import { Preview } from "../src/components/Preview";
import { newDocument } from "../src/features/documents";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

describe("bounded picture cache", () => {
  it("drops the least recently used entries when the budget is exceeded", () => {
    const cache = new LruCache<string>(10, (s) => s.length);
    cache.set("a", "1234");
    cache.set("b", "1234");
    expect(cache.get("a")).toBe("1234"); // a is now the newest
    cache.set("c", "1234"); // 12 bytes: the oldest (b) goes
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.bytes).toBe(8);
  });

  it("never keeps an entry larger than the whole budget, and replaces entries in place", () => {
    const cache = new LruCache<string>(10, (s) => s.length, 2);
    cache.set("big", "x".repeat(11));
    expect(cache.has("big")).toBe(false);
    cache.set("a", "12");
    cache.set("a", "123");
    expect(cache.bytes).toBe(3);
    cache.set("b", "1");
    cache.set("c", "1"); // more than 2 entries: a goes
    expect([cache.has("a"), cache.has("b"), cache.has("c")]).toEqual([false, true, true]);
    cache.clear();
    expect(cache.size + cache.bytes).toBe(0);
    expect(IMAGE_CACHE_BYTES).toBeGreaterThan(10 * 1024 * 1024);
  });
});

describe("large documents", () => {
  it("are not linted on every pause", () => {
    expect(lintsDocumentOf(LARGE_DOCUMENT_CHARS)).toBe(true);
    expect(lintsDocumentOf(LARGE_DOCUMENT_CHARS + 1)).toBe(false);
  });
});

describe("pictures from the web in the preview", () => {
  it("is a setting that's on by default and can be turned off", () => {
    expect(DEFAULT_SETTINGS.previewRemoteImages).toBe(true);
    expect(sanitizeSettings({ previewRemoteImages: false }).previewRemoteImages).toBe(false);
    expect(sanitizeSettings({ previewRemoteImages: "yes" }).previewRemoteImages).toBe(true);
  });

  it("shows a placeholder instead of loading the picture when off, and keeps local pictures", () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, previewDebounceMs: 0, previewRemoteImages: false } });
    render(<Preview />);
    act(() => {
      newDocument("![Logo](https://example.com/logo.png)\n\n![Inline](data:image/gif;base64,R0lGODlhAQABAAAAACw=)");
    });
    expect(document.querySelector('img[src^="https://"]')).toBeNull();
    expect(screen.getByText(/pictures from the web are off/)).toBeInTheDocument();
    expect(document.querySelector('img[src^="data:"]')).not.toBeNull();

    act(() => useSettings.getState().update({ previewRemoteImages: true }));
    expect(document.querySelector('img[src="https://example.com/logo.png"]')).not.toBeNull();
  });
});
