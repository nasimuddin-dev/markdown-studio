import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Website browser checks (npm run docs:test); expects `npm --prefix website run preview` on port 4173. */
export default defineConfig({
  ...base,
  testDir: "website/scripts",
  testMatch: "site.spec.ts",
  webServer: {
    command: "npm --prefix website run preview -- --port 4173",
    url: "http://localhost:4173/markpion/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
