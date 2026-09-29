import GithubSlugger from "github-slugger";
import { backend } from "../services";
import { isInside, isMarkdownPath } from "../services/paths";
import { extractHeadings } from "./outline";
import { findAllLinks, lintMarkdown, localTargets, type Severity } from "./lint";

export interface LinkProblem {
  line: number;
  column: number;
  length: number;
  severity: Severity;
  rule: string;
  message: string;
}

export interface LinkReport {
  files: Array<{ path: string; problems: LinkProblem[] }>;
  filesChecked: number;
  linksChecked: number;
}

/** Heading ids (GitHub-style slugs) and explicit HTML anchors of a document. */
export function documentAnchors(text: string): Set<string> {
  const slugger = new GithubSlugger();
  const anchors = new Set(extractHeadings(text).map((h) => slugger.slug(h.text)));
  for (const m of text.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(m[1]);
  return anchors;
}

function fragmentOf(target: string): string {
  const i = target.indexOf("#");
  if (i < 0) return "";
  try {
    return decodeURIComponent(target.slice(i + 1));
  } catch {
    return target.slice(i + 1);
  }
}

/**
 * Checks every Markdown file in the workspace: links and images to files that
 * don't exist, `#anchors` that match no heading (in the same file or in the
 * linked Markdown file), and empty links. Targets outside the workspace are
 * not checked.
 */
export async function checkWorkspaceLinks(root: string, onProgress?: (done: number, total: number) => void): Promise<LinkReport> {
  const b = backend();
  const docs = (await b.listWorkspaceFiles(root)).filter(isMarkdownPath);
  const texts = new Map<string, Promise<string | null>>();
  const read = (path: string) => {
    if (!texts.has(path)) texts.set(path, b.readTextFile(path).then((f) => f.content, () => null));
    return texts.get(path)!;
  };
  const exists = new Map<string, Promise<boolean | null>>();
  const check = (path: string) => {
    if (!exists.has(path)) exists.set(path, b.fileMtime(path).then((m) => m !== null, () => null));
    return exists.get(path)!;
  };
  const anchors = new Map<string, Set<string> | null>();
  const anchorsOf = async (path: string) => {
    if (!anchors.has(path)) {
      const text = await read(path);
      anchors.set(path, text === null ? null : documentAnchors(text));
    }
    return anchors.get(path)!;
  };

  const report: LinkReport = { files: [], filesChecked: 0, linksChecked: 0 };
  for (const [i, doc] of docs.entries()) {
    onProgress?.(i, docs.length);
    const text = await read(doc);
    if (text === null) continue;
    report.filesChecked++;
    const starts = [0];
    for (let k = 0; k < text.length; k++) if (text[k] === "\n") starts.push(k + 1);
    const at = (from: number, to: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= from) lo = mid;
        else hi = mid - 1;
      }
      return { line: lo + 1, column: from - starts[lo], length: to - from };
    };

    const problems: LinkProblem[] = [];
    // Same-document anchors and empty links come from the editor's lint rules.
    for (const p of lintMarkdown(text)) {
      if (p.rule === "broken-anchor" || p.rule === "empty-link") problems.push({ ...at(p.from, p.to), severity: p.severity, rule: p.rule, message: p.message });
    }
    const links = findAllLinks(text);
    report.linksChecked += links.length;
    for (const { link, path } of localTargets(links, doc)) {
      const where = at(link.from, link.to);
      if (!path) {
        problems.push({ ...where, severity: "warning", rule: "broken-link", message: `Link points outside the file system root: ${link.target}` });
        continue;
      }
      if (!isInside(path, root)) continue;
      const found = await check(path);
      if (found === false) {
        problems.push({
          ...where,
          severity: "warning",
          rule: link.image ? "missing-image" : "broken-link",
          message: `${link.image ? "Image" : "Linked file"} not found: ${link.target}`,
        });
        continue;
      }
      const fragment = fragmentOf(link.target);
      if (found && fragment && isMarkdownPath(path)) {
        const ids = await anchorsOf(path);
        if (ids && !ids.has(fragment) && !ids.has(fragment.toLowerCase())) {
          problems.push({ ...where, severity: "warning", rule: "broken-anchor", message: `No heading matches “#${fragment}” in ${link.target.split("#")[0]}.` });
        }
      }
    }
    if (problems.length) report.files.push({ path: doc, problems: problems.sort((a, b) => a.line - b.line || a.column - b.column) });
  }
  onProgress?.(docs.length, docs.length);
  return report;
}
