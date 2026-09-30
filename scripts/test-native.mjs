/**
 * Runs the native end-to-end tests (e2e-native/) against a debug build of the
 * desktop app, through tauri-driver and Microsoft Edge WebDriver (Windows).
 *
 *   npm run test:native            builds the app (debug, no installer), then tests
 *   npm run test:native -- --no-build   tests the existing debug build
 *
 * Needs `cargo install tauri-driver --locked`. The msedgedriver matching the
 * installed WebView2 runtime is downloaded from Microsoft on first use into
 * %LOCALAPPDATA%\markpion-dev\msedgedriver\<version>\. The debug app keeps
 * its settings, recent files, session and web storage in a temporary folder
 * (MARKPION_TEST_DATA_DIR), so your own profile is left alone; the run fails
 * if the profile changes anyway.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "win32") {
  console.error("The native end-to-end tests run on Windows only (tauri-driver needs a WebDriver for the system web view).");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const app = join(root, "src-tauri", "target", "debug", "markpion.exe");

// A running Markpion would receive the test app's launch (single instance) instead.
const running = execFileSync("tasklist", ["/FI", "IMAGENAME eq markpion.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
if (/markpion\.exe/i.test(running)) {
  console.error("Markpion is running. Close it first: a second copy would hand its files to the running one.");
  process.exit(1);
}

if (!process.argv.includes("--no-build")) {
  console.log("Building the app (debug, no installer)…");
  const build = spawnSync("npx tauri build --debug --no-bundle", { cwd: root, stdio: "inherit", shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
if (!existsSync(app)) {
  console.error(`No app at ${app}. Run without --no-build first.`);
  process.exit(1);
}

/** The installed WebView2 runtime's version, from the registry. */
function webViewVersion() {
  const key = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
  for (const hive of [`HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${key}`, `HKCU\\Software\\Microsoft\\EdgeUpdate\\Clients\\${key}`]) {
    const out = spawnSync("reg", ["query", hive, "/v", "pv"], { encoding: "utf8" });
    const m = /pv\s+REG_SZ\s+([\d.]+)/.exec(out.stdout ?? "");
    if (m) return m[1];
  }
  throw new Error("WebView2 runtime not found.");
}

const version = webViewVersion();
const driverDir = join(process.env.LOCALAPPDATA ?? homedir(), "markpion-dev", "msedgedriver", version);
const driver = join(driverDir, "msedgedriver.exe");
if (!existsSync(driver)) {
  console.log(`Downloading Microsoft Edge WebDriver ${version} (matches the installed WebView2)…`);
  mkdirSync(driverDir, { recursive: true });
  const zip = join(driverDir, "edgedriver.zip");
  const res = await fetch(`https://msedgedriver.microsoft.com/${version}/edgedriver_win64.zip`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Force -Path '${zip}' -DestinationPath '${driverDir}'`]);
}

const tauriDriver = join(homedir(), ".cargo", "bin", "tauri-driver.exe");
if (!existsSync(tauriDriver)) {
  console.error("tauri-driver isn't installed. Run: cargo install tauri-driver --locked");
  process.exit(1);
}

// The debug build keeps everything it stores in this folder instead of the
// real profile (see test_data_dir in src-tauri/src/lib.rs).
const data = mkdtempSync(join(tmpdir(), "markpion-native-data-"));
const env = { ...process.env, MARKPION_TEST_DATA_DIR: data };

// A safety net: the real profile's files must not change during the run.
const identifier = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8")).identifier;
const profile = ["settings.json", "recent.json"].map((f) => join(process.env.APPDATA ?? "", identifier, f));
const stamp = () => profile.map((f) => (existsSync(f) ? statSync(f).mtimeMs : 0)).join();
const before = stamp();
const driverProcess = spawn(tauriDriver, ["--native-driver", driver], { env, stdio: ["ignore", "inherit", "inherit"] });

// Wait for the driver to listen.
for (let i = 0; ; i++) {
  try {
    await fetch("http://127.0.0.1:4444/status");
    break;
  } catch {
    if (i > 50) throw new Error("tauri-driver didn't start.");
    await new Promise((r) => setTimeout(r, 200));
  }
}

const tests = readdirSync(join(root, "e2e-native")).filter((f) => f.endsWith(".test.mjs")).map((f) => join("e2e-native", f));
// The tests launch the app a second time to hand it files, with the same AppData.
const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...tests], { cwd: root, stdio: "inherit", env: { ...env, MARKPION_APP: app } });
driverProcess.kill();
if (stamp() !== before) {
  console.error("The real Markpion profile changed during the tests; the test data folder wasn't used.");
  process.exit(1);
}
process.exit(run.status ?? 1);
