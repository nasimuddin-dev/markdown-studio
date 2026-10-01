import { afterEach, describe, expect, it, vi } from "vitest";
import { compareVersions, fetchLatestRelease, noticesPage, RELEASES_PAGE } from "../src/services/updates";
import { checkForUpdates } from "../src/features/updates";
import { useUi } from "../src/stores/uiStore";
import { autoAnswer, setupBackend } from "./helpers";

const release = (tag: string, extra: Record<string, unknown> = {}) =>
  vi.fn(async () => new Response(JSON.stringify({ tag_name: tag, html_url: `https://github.com/o/r/releases/tag/${tag}`, body: "## New\n\n- **Faster** things", ...extra })));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("version comparison", () => {
  it("compares numerically, with pre-releases before releases", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("v0.5.0", "0.5.0")).toBe(0);
    expect(compareVersions("0.5", "0.5.1")).toBe(-1);
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.1")).toBe(1);
  });
});

describe("latest release", () => {
  it("parses GitHub's response and only trusts github.com links", async () => {
    expect(await fetchLatestRelease(release("v1.2.3") as unknown as typeof fetch)).toMatchObject({ version: "1.2.3", url: "https://github.com/o/r/releases/tag/v1.2.3" });
    const evil = release("v1.2.3", { html_url: "https://evil.example/x" });
    expect((await fetchLatestRelease(evil as unknown as typeof fetch)).url).toBe(RELEASES_PAGE);
    await expect(fetchLatestRelease(vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch)).rejects.toThrow("403");
    await expect(fetchLatestRelease(release("latest") as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("check for updates", () => {
  it("offers a newer version and opens its page on Download", async () => {
    setupBackend();
    vi.stubGlobal("fetch", release("v99.0.0"));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const answered = autoAnswer("install");
    expect(await checkForUpdates({ manual: false })).toBe("available");
    answered.stop();
    expect(answered.titles).toEqual(["Update available"]);
    expect(open).toHaveBeenCalledWith("https://github.com/o/r/releases/tag/v99.0.0", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("remembers a skipped version for automatic checks only", async () => {
    setupBackend();
    vi.stubGlobal("fetch", release("v99.0.0"));
    let answered = autoAnswer("skip");
    await checkForUpdates({ manual: false });
    answered.stop();
    answered = autoAnswer("later");
    await checkForUpdates({ manual: false });
    answered.stop();
    expect(answered.titles).toEqual([]);
    answered = autoAnswer("later");
    await checkForUpdates({ manual: true });
    answered.stop();
    expect(answered.titles).toEqual(["Update available"]);
  });

  it("reports up to date and errors only when checked manually", async () => {
    setupBackend();
    vi.stubGlobal("fetch", release("v0.0.1"));
    expect(await checkForUpdates({ manual: true })).toBe("current");
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/up to date/);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    useUi.setState({ toasts: [] });
    expect(await checkForUpdates({ manual: false })).toBe("error");
    expect(useUi.getState().toasts).toEqual([]);
    expect(await checkForUpdates({ manual: true })).toBe("error");
    expect(useUi.getState().toasts.at(-1)?.kind).toBe("error");
  });
});

describe("in-app update (desktop)", () => {
  const nativeBackend = (install: () => Promise<void>) => {
    const b = setupBackend({ "/ws/a.md": "saved" });
    Object.defineProperty(b, "capabilities", { value: { ...b.capabilities, desktop: true, selfUpdate: true } });
    b.checkAppUpdate = async () => ({ version: "9.0.0", currentVersion: "0.8.0", notes: "## 9.0.0\n\nBetter things", date: null });
    const progress: Array<(d: number, t: number | null) => void> = [];
    b.onUpdateProgress = async (h) => {
      progress.push(h);
      return () => {};
    };
    b.installAppUpdate = vi.fn(async () => {
      progress.forEach((h) => h(5 * 1024 * 1024, 10 * 1024 * 1024));
      expect(useUi.getState().progress?.message).toMatch(/5\.0 of 10\.0 MB/);
      await install();
    });
    return b;
  };

  it("offers Update Now, shows progress and installs", async () => {
    const b = nativeBackend(async () => {});
    const answered = autoAnswer("install");
    expect(await checkForUpdates({ manual: false })).toBe("available");
    answered.stop();
    expect(b.installAppUpdate).toHaveBeenCalledOnce();
    expect(useUi.getState().progress).toBeNull();
  });

  it("saves open documents first and postpones if saving fails", async () => {
    const b = nativeBackend(async () => {});
    const { openPath } = await import("../src/features/documents");
    const { useDocuments } = await import("../src/stores/documentsStore");
    const id = (await openPath("/ws/a.md"))!;
    useDocuments.getState().setContent(id, "edited");
    const answered = autoAnswer("install");
    await checkForUpdates({ manual: true });
    answered.stop();
    expect((await b.readTextFile("/ws/a.md")).content).toBe("edited");
    expect(b.installAppUpdate).toHaveBeenCalledOnce();

    useDocuments.getState().setContent(id, "edited again");
    b.writeTextFile = async () => { throw new Error("disk full"); };
    (b.installAppUpdate as ReturnType<typeof vi.fn>).mockClear();
    const again = autoAnswer("install");
    await checkForUpdates({ manual: true });
    again.stop();
    expect(b.installAppUpdate).not.toHaveBeenCalled();
  });

  it("offers the download page when there is no in-place update for this platform (macOS, Linux)", async () => {
    const b = nativeBackend(async () => {});
    b.checkAppUpdate = async () => { throw new Error("the platform `darwin-aarch64` was not found on the response `platforms` object"); };
    vi.stubGlobal("fetch", release("v99.0.0"));
    const opened = vi.fn(async () => {});
    b.openExternal = opened;
    const answered = autoAnswer("install");
    expect(await checkForUpdates({ manual: false })).toBe("available");
    answered.stop();
    expect(opened).toHaveBeenCalledWith("https://github.com/o/r/releases/tag/v99.0.0");
    expect(b.installAppUpdate).not.toHaveBeenCalled();
  });

  it("keeps the current version running when installing fails", async () => {
    nativeBackend(async () => { throw new Error("Update failed: signature mismatch"); });
    const answered = autoAnswer("install");
    await checkForUpdates({ manual: true });
    answered.stop();
    expect(useUi.getState().progress).toBeNull();
    expect(useUi.getState().toasts.at(-1)).toMatchObject({ kind: "error" });
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/current version is unchanged.*signature mismatch/);
  });
});

describe("third-party notices", () => {
  it("links to the notices of the running version", () => {
    expect(noticesPage("0.25.0")).toBe("https://github.com/nasimuddin-dev/markpion/blob/v0.25.0/THIRD_PARTY_NOTICES.md");
  });
});
