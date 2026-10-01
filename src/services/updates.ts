const RELEASES_API = "https://api.github.com/repos/nasimuddin-dev/markpion/releases/latest";
export const RELEASES_PAGE = "https://github.com/nasimuddin-dev/markpion/releases/latest";
/** The licenses of the fonts and packages a version includes (also installed beside the app). */
export const noticesPage = (version: string) => `https://github.com/nasimuddin-dev/markpion/blob/v${version}/THIRD_PARTY_NOTICES.md`;

export interface LatestRelease {
  version: string;
  url: string;
  notes: string;
  publishedAt: string | null;
}

/** Compares dotted versions ("v0.10.1" > "0.9.3"); pre-release suffixes sort before the release. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre = ""] = v.trim().replace(/^v/i, "").split("-", 2);
    return { nums: core.split(".").map((n) => parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Fetches the newest published (non-draft, non-prerelease) GitHub release. */
export async function fetchLatestRelease(fetchFn: typeof fetch = fetch): Promise<LatestRelease> {
  const res = await fetchFn(RELEASES_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  const data = (await res.json()) as { tag_name?: unknown; html_url?: unknown; body?: unknown; published_at?: unknown };
  if (typeof data.tag_name !== "string" || !/^v?\d+(\.\d+)*/.test(data.tag_name)) throw new Error("Unexpected release data");
  const url = typeof data.html_url === "string" && data.html_url.startsWith("https://github.com/") ? data.html_url : RELEASES_PAGE;
  return {
    version: data.tag_name.replace(/^v/i, ""),
    url,
    notes: typeof data.body === "string" ? data.body : "",
    publishedAt: typeof data.published_at === "string" ? data.published_at : null,
  };
}
