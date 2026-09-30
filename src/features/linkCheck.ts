import GithubSlugger from "github-slugger";
import { backend } from "../services";
import { basename, dirname, isInside, isMarkdownPath } from "../services/paths";
import { extractHeadings } from "./outline";
import { frontMatterTitle } from "../services/frontMatter";
import { closestFileName, findAllLinks, maskCode, lintMarkdown, localTargets, type Severity } from "./lint";

export interface LinkProblem {
  line: number;
  column: number;
  length: number;
  severity: Severity;
  rule: string;
  message: string;
}

/** A link from one Markdown file to another (for “Links to this document”). */
export interface IncomingLink {
  /** The file the link is in. */
  from: string;
  /** The Markdown file it points to. */
  to: string;
  line: number;
  column: number;
  length: number;
  /** The link text (or the reference label), else the address as written. */
  label: string;
}

export interface LinkReport {
  files: Array<{ path: string; problems: LinkProblem[] }>;
  incoming: IncomingLink[];
  filesChecked: number;
  linksChecked: number;
}

/** A place that names a document without linking to it. */
export interface Mention {
  path: string;
  line: number;
  column: number;
  length: number;
  /** The line, trimmed, for the list. */
  context: string;
}

/** What a document is called: its file name without .md, and its title (front matter, else first H1), 3+ characters. */
export function documentNames(docPath: string, text: string): string[] {
  const stem = docPath.split(/[\\/]/).pop()!.replace(/\.(md|markdown)$/i, "");
  const title = frontMatterTitle(text) ?? extractHeadings(text).find((h) => h.level === 1)?.text ?? "";
  return [...new Set([stem, title].map((n) => n.trim()).filter((n) => n.length >= 3))];
}

/**
 * Unlinked mentions: whole-word, case-insensitive occurrences of `names` in the
 * folder's other Markdown files, outside code and links. At most `limit`.
 */
export async function findMentions(root: string, docPath: string, names: string[], limit = 200): Promise<Mention[]> {
  if (!names.length) return [];
  const b = backend();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  const out: Mention[] = [];
  const paths = (await b.listWorkspaceFiles(root).catch(() => [] as string[])).filter((p) => isMarkdownPath(p) && !(isInside(p, docPath) && isInside(docPath, p)));
  for (const path of paths) {
    const text = await b.readTextFile(path).then((f) => f.content, () => null);
    if (text === null) continue;
    // Code and links (whatever they point to) don't count as mentions.
    let masked = maskCode(text);
    const links = findAllLinks(text);
    for (const link of links) masked = masked.slice(0, link.from) + " ".repeat(link.to - link.from) + masked.slice(link.to);
    // A line that already links to the document doesn't need its mentions listed.
    const linkedLines = new Set(
      localTargets(links, path)
        .filter(({ path: target }) => target && isInside(target, docPath) && isInside(docPath, target))
        .map(({ link }) => text.slice(0, link.from).split("\n").length - 1),
    );
    const lines = masked.split("\n");
    const original = text.split("\n");
    for (const [i, line] of lines.entries()) {
      if (linkedLines.has(i)) continue;
      for (const m of line.matchAll(pattern)) {
        out.push({ path, line: i + 1, column: m.index!, length: m[0].length, context: original[i].trim().slice(0, 120) });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
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
  const listings = new Map<string, Promise<string[]>>();
  /** The file in the same folder a broken link probably meant, if one clearly is. */
  const nearName = async (path: string) => {
    const dir = dirname(path);
    if (!listings.has(dir)) listings.set(dir, b.listDir(dir, { images: true }).then((es) => es.filter((e) => !e.isDir).map((e) => e.name), () => []));
    return closestFileName(basename(path), await listings.get(dir)!);
  };
  const anchors = new Map<string, Set<string> | null>();
  const anchorsOf = async (path: string) => {
    if (!anchors.has(path)) {
      const text = await read(path);
      anchors.set(path, text === null ? null : documentAnchors(text));
    }
    return anchors.get(path)!;
  };

  const report: LinkReport = { files: [], incoming: [], filesChecked: 0, linksChecked: 0 };
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
        const near = await nearName(path);
        problems.push({
          ...where,
          severity: "warning",
          rule: link.image ? "missing-image" : "broken-link",
          message: `${link.image ? "Image" : "Linked file"} not found: ${link.target}${near ? `. Did you mean “${near}”?` : ""}`,
        });
        continue;
      }
      if (found && isMarkdownPath(path) && !link.image && !(isInside(path, doc) && isInside(doc, path))) report.incoming.push({ from: doc, to: path, ...where, label: link.text.trim() || link.target });
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
