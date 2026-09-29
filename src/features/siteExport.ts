import { backend } from "../services";
import { describeError } from "../services/errors";
import { buildHtmlDocument, documentTitle } from "../services/exportHtml";
import { basename, isInside, join, relativePath } from "../services/paths";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { ask, notify } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { combineOrder } from "./combine";

/**
 * Export Folder as HTML Site: every Markdown file in the open folder becomes a
 * standalone HTML page in a chosen folder, mirroring the folder structure.
 * Links between documents point to the HTML pages, images are embedded, each
 * page links back to the contents, and index.html lists every page (unless
 * the folder has its own index.md).
 */

export interface SitePage {
  /** The Markdown file. */
  source: string;
  /** Path of the HTML page inside the site, with "/" separators. */
  href: string;
}

const MARKDOWN_EXT = /\.(md|markdown)$/i;

/** The site's pages, in reading order (README first in each folder). */
export function planSite(files: string[], root: string): SitePage[] {
  const sources = combineOrder(files.filter((f) => MARKDOWN_EXT.test(f) && isInside(f, root)), root);
  const pages: SitePage[] = [];
  for (const source of sources) {
    const rel = relativePath(root, source);
    if (!rel || rel.startsWith("..")) continue;
    pages.push({ source, href: rel.replace(MARKDOWN_EXT, ".html") });
  }
  return pages;
}

/**
 * Points relative links to Markdown files (`guide.md#setup`) at their HTML
 * pages (`guide.html#setup`). Web addresses and other files are left alone.
 */
export function rewriteMarkdownLinks(html: string): string {
  return html.replace(/(<a\b[^>]*?\bhref=")([^"]*)"/gi, (whole, start: string, href: string) => {
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("#")) return whole;
    const m = /^([^?#]*?)\.(?:md|markdown)([?#][^]*)?$/i.exec(href);
    return m ? `${start}${m[1]}.html${m[2] ?? ""}"` : whole;
  });
}

/** Adds a link back to the contents page at the top of a page `depth` folders deep. */
export function addSiteNav(html: string, depth: number): string {
  const href = `${"../".repeat(depth)}index.html`;
  const nav = `<nav style="max-width:900px;margin:16px auto 0;padding:0 32px;font:14px system-ui,sans-serif"><a href="${href}">← Contents</a></nav>`;
  return html.replace("<body>", `<body>\n${nav}`);
}

/** The contents page as Markdown: pages grouped by folder, with their titles. */
export function siteIndexMarkdown(siteTitle: string, pages: Array<SitePage & { title: string }>): string {
  const esc = (s: string) => s.replace(/([\\[\]])/g, "\\$1");
  const lines = [`# ${esc(siteTitle)}`, ""];
  let folder: string | null = null;
  for (const page of pages) {
    const dir = page.href.includes("/") ? page.href.slice(0, page.href.lastIndexOf("/")) : "";
    if (dir !== folder) {
      if (dir) lines.push("", `## ${esc(dir)}`, "");
      folder = dir;
    }
    lines.push(`- [${esc(page.title)}](${encodeURI(page.href)})`);
  }
  return lines.join("\n") + "\n";
}

/** Writes `relPath` ("a/b/page.html") under `out`, creating folders as needed. */
async function writeSiteFile(out: string, relPath: string, html: string) {
  const parts = relPath.split("/");
  let dir = out;
  for (const part of parts.slice(0, -1)) dir = await backend().ensureFolder(dir, part);
  await backend().writeTextFile({ path: join(dir, parts.at(-1)!), content: html, lineEnding: "lf", bom: false, expectedMtime: null, force: true });
}

const sitePath = (out: string, href: string) => href.split("/").reduce((dir, part) => join(dir, part), out);

export async function exportFolderAsHtmlSite() {
  const root = useWorkspace.getState().root;
  if (!root) {
    notify("info", "Open a folder first to export it as an HTML site.");
    return;
  }
  try {
    const pages = planSite(await backend().listWorkspaceFiles(root), root);
    if (!pages.length) {
      notify("info", "No Markdown files found in this folder.");
      return;
    }
    const out = await backend().pickExportFolder();
    if (!out) return;

    const hasIndex = pages.some((p) => p.href.toLowerCase() === "index.html");
    const targets = [...pages.map((p) => p.href), ...(hasIndex ? [] : ["index.html"])];
    let existing = 0;
    for (const href of targets) {
      if ((await backend().fileMtime(sitePath(out, href)).catch(() => null)) !== null) existing++;
    }
    if (existing > 0) {
      const choice = await ask({
        title: "Replace existing files?",
        message: `${existing} of the ${targets.length} HTML files already exist in “${basename(out)}” and will be replaced.`,
        buttons: [
          { id: "cancel", label: "Cancel" },
          { id: "replace", label: "Replace", variant: "danger" },
        ],
        cancelId: "cancel",
      });
      if (choice !== "replace") return;
    }

    const s = useSettings.getState().settings;
    const features = { math: s.renderMath, diagrams: s.renderDiagrams };
    // Unsaved edits in open tabs are exported as shown in the editor.
    const key = (p: string) => p.replace(/\\/g, "/").toLowerCase();
    const open = new Map(useDocuments.getState().docs.filter((d) => d.path).map((d) => [key(d.path!), d.content]));
    const loadImage = (path: string) => backend().readImage(path);
    notify("info", `Exporting ${pages.length} page${pages.length > 1 ? "s" : ""}…`);

    const written: Array<SitePage & { title: string }> = [];
    const failed: string[] = [];
    for (const page of pages) {
      try {
        const markdown = open.get(key(page.source)) ?? (await backend().readTextFile(page.source)).content;
        const name = basename(page.source);
        const html = await buildHtmlDocument({ markdown, name, docPath: page.source, loadImage, features });
        const depth = page.href.split("/").length - 1;
        await writeSiteFile(out, page.href, addSiteNav(rewriteMarkdownLinks(html), depth));
        written.push({ ...page, title: documentTitle(markdown, name) });
      } catch {
        failed.push(basename(page.source));
      }
    }
    if (!hasIndex && written.length) {
      const index = await buildHtmlDocument({ markdown: siteIndexMarkdown(basename(root), written), name: "index.md", docPath: null, features });
      await writeSiteFile(out, "index.html", index);
    }
    if (failed.length) {
      notify("warning", `Exported ${written.length} of ${pages.length} pages to ${out}. Couldn't export: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}.`);
    } else {
      notify("success", `Exported ${written.length} page${written.length > 1 ? "s" : ""} to ${out}. Open index.html to browse them.`);
    }
  } catch (e) {
    notify("error", describeError(e, "export the folder as an HTML site"));
  }
}
