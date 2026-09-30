import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

/** UI audit screenshots and local visual regression; not part of the e2e suite. */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: ["ui-audit.spec.ts", "visual.spec.ts"],
  snapshotPathTemplate: "{testDir}/out/visual/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { ...base.use, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
});
