import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { setBackend } from "../src/services";
import { createDemoBackend } from "../src/services/memoryBackend";

// The app loads the browser backend in main.tsx; tests start with a fresh demo backend.
setBackend(createDemoBackend());

// Some dialogs load on first use (a dynamic import), which can take over a second when the test run is busy.
configure({ asyncUtilTimeout: 5000 });

// jsdom lacks ResizeObserver, which the resizable panel layout relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// CodeMirror measures text ranges; jsdom doesn't implement layout.
if (typeof Range !== "undefined") {
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getBoundingClientRect ??= rect;
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
}

Element.prototype.scrollIntoView ??= function scrollIntoView() {};
