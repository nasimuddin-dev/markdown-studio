import { backend } from "../services";
import { compareVersions, fetchLatestRelease } from "../services/updates";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { ask, notify, useUi } from "../stores/uiStore";
import { saveAll } from "./documents";

const SKIP_KEY = "markpion.update.skip";
const LAST_KEY = "markpion.update.lastCheck";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable; the check simply runs again next time.
  }
}

/** First paragraph or so of the release notes, as plain text. */
function summarise(notes: string) {
  const text = notes
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\|[^\n]*\|/g, "")
    .replace(/[#*_`>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text.length > 400 ? text.slice(0, 400).replace(/\s+\S*$/, "") + "…" : text;
}

interface Found {
  version: string;
  current: string;
  notes: string;
  /** Desktop: installable in place. Browser demo: only a download page. */
  url: string | null;
}

async function findUpdate(): Promise<Found | null> {
  const b = backend();
  if (b.capabilities.selfUpdate) {
    try {
      const u = await b.checkAppUpdate();
      return u ? { version: u.version, current: u.currentVersion, notes: u.notes ?? "", url: null } : null;
    } catch (e) {
      // No in-place update for this platform (signed updates are published for
      // Windows only so far) or the manifest is unreachable: fall back to the
      // release page, so macOS and Linux users still hear about new versions.
      b.log("warn", "update.check", (e as Error)?.message ?? String(e));
    }
  }
  const current = (await b.appInfo()).version;
  const latest = await fetchLatestRelease();
  return compareVersions(latest.version, current) > 0 ? { version: latest.version, current, notes: latest.notes, url: latest.url } : null;
}

const MB = 1024 * 1024;

/**
 * Downloads, verifies (minisign signature) and installs the update. Open
 * documents are saved first; the installer replaces the current version and
 * restarts Markpion. Returns false if it was cancelled or failed, in
 * which case the current version keeps running unchanged (UPD-005).
 */
export async function installUpdate(version: string): Promise<boolean> {
  const b = backend();
  const dirty = useDocuments.getState().docs.some((d) => d.content !== d.savedContent);
  if (dirty && !(await saveAll())) {
    notify("info", "Update postponed. Save or close your unsaved documents, then try again.");
    return false;
  }
  const ui = useUi.getState();
  ui.setProgress({ title: `Updating to ${version}`, message: "Downloading the update…", fraction: null });
  const unlisten = await b.onUpdateProgress((downloaded, total) => {
    const done = total ? `${(downloaded / MB).toFixed(1)} of ${(total / MB).toFixed(1)} MB` : `${(downloaded / MB).toFixed(1)} MB`;
    const finished = total !== null && downloaded >= total;
    useUi.getState().setProgress({
      title: `Updating to ${version}`,
      message: finished ? "Verifying and installing… Markpion will restart." : `Downloading the update… ${done}`,
      fraction: total && !finished ? downloaded / total : null,
    });
  });
  try {
    b.log("info", "update.install", version);
    await b.installAppUpdate();
    return true; // not normally reached: the app exits while the installer runs
  } catch (e) {
    b.log("error", "update.install", (e as Error)?.message ?? String(e));
    notify("error", `Markpion ${version} couldn't be installed; your current version is unchanged. ${(e as Error)?.message ?? ""}`.trim());
    return false;
  } finally {
    unlisten();
    useUi.getState().setProgress(null);
  }
}

/**
 * UPD-001..005: checks GitHub for a newer release. In the desktop app the
 * update is downloaded, its signature verified against the public key built
 * into the app, and installed in place of the current version (the app
 * restarts). The browser demo just links to the release. `manual` reports
 * "up to date" and errors, and ignores a previously skipped version.
 */
export async function checkForUpdates({ manual }: { manual: boolean }): Promise<"available" | "current" | "error"> {
  const b = backend();
  let found: Found | null;
  try {
    found = await findUpdate();
    store(LAST_KEY, String(Date.now()));
  } catch (e) {
    b.log("warn", "update.check", (e as Error)?.message ?? String(e));
    if (manual) notify("error", "Couldn't check for updates. Check your internet connection and try again.");
    return "error";
  }

  if (!found) {
    if (manual) {
      const current = (await b.appInfo().catch(() => null))?.version;
      notify("success", `You're up to date${current ? `. Markpion ${current} is the latest version` : ""}.`);
    }
    return "current";
  }
  if (!manual && load(SKIP_KEY) === found.version) return "available";

  const notes = summarise(found.notes);
  const installable = found.url === null;
  const choice = await ask({
    title: "Update available",
    message: `Markpion ${found.version} is available. You have ${found.current}.`,
    detail:
      (notes ? notes + "\n\n" : "") +
      (installable
        ? "Update now to download and install it. The download is verified, then it replaces your current version; your settings and files are kept, and Markpion restarts."
        : "Download the installer and run it; your settings and files are kept."),
    buttons: [
      { id: "skip", label: "Skip This Version" },
      { id: "later", label: "Later" },
      { id: "install", label: installable ? "Update Now" : "Download", variant: "primary" },
    ],
    cancelId: "later",
  });
  if (choice === "skip") store(SKIP_KEY, found.version);
  if (choice === "install") {
    if (installable) await installUpdate(found.version);
    else {
      try {
        await b.openExternal(found.url!);
      } catch (e) {
        notify("error", `Couldn't open the download page: ${(e as Error).message}`);
      }
    }
  }
  return "available";
}

/** Checks each time the desktop app starts, when enabled in Settings. */
export function scheduleUpdateCheck() {
  if (!backend().capabilities.selfUpdate || !useSettings.getState().settings.checkForUpdates) return;
  // Let startup (session restore, recovery prompts) finish first.
  setTimeout(() => void checkForUpdates({ manual: false }), 5000);
}
