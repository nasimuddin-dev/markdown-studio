import { backend } from "../services";
import { basename, dirname } from "../services/paths";
import { useWorkspace } from "../stores/workspaceStore";
import { ask, notify } from "../stores/uiStore";
import { convertSource, kindForPath, writeConverted } from "./importing";
import { refreshDir } from "./workspace";

export interface BatchResult {
  converted: string[];
  skipped: string[];
  failed: { path: string; reason: string }[];
}

const mdPathFor = (path: string) => path.replace(/\.[^./\\]+$/, ".md");

/**
 * Converts every Word, PDF, HTML and CSV/TSV file in the open folder to a
 * Markdown file beside it. Files that already have a same-named .md are left
 * alone, so running it again only converts new documents.
 */
export async function convertWorkspaceDocuments(): Promise<BatchResult | null> {
  const root = useWorkspace.getState().root;
  if (!root) {
    notify("info", "Open a folder first to convert its documents.");
    return null;
  }
  const b = backend();
  const [sources, existing] = await Promise.all([b.listConvertibleFiles(root), b.listWorkspaceFiles(root)]);
  const taken = new Set(existing.map((p) => p.toLowerCase()));
  // Two sources with the same name (report.pdf + report.docx) would target one .md: first wins.
  const pending: string[] = [];
  const skipped: string[] = [];
  for (const path of sources) {
    const md = mdPathFor(path).toLowerCase();
    if (taken.has(md)) skipped.push(path);
    else {
      pending.push(path);
      taken.add(md);
    }
  }
  if (!pending.length) {
    notify("info", sources.length ? "Every document in this folder already has a Markdown version." : "No Word, PDF, HTML or CSV files found in this folder.");
    return { converted: [], skipped, failed: [] };
  }

  const choice = await ask({
    title: "Convert folder to Markdown",
    message: `Convert ${pending.length} document${pending.length === 1 ? "" : "s"} to Markdown?`,
    detail:
      "Each file gets a .md file beside it (images go to assets/). The originals are not changed." +
      (skipped.length ? ` ${skipped.length} file${skipped.length === 1 ? " is" : "s are"} skipped because a .md with the same name exists.` : ""),
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "convert", label: "Convert", variant: "primary" },
    ],
    cancelId: "cancel",
  });
  if (choice !== "convert") return null;

  const result: BatchResult = { converted: [], skipped, failed: [] };
  const dirs = new Set<string>();
  if (pending.length > 1) notify("info", `Converting ${pending.length} documents…`);
  for (const path of pending) {
    const name = basename(path);
    try {
      const kind = kindForPath(path)!;
      const converted = await convertSource(kind, await b.readBinaryFile(path), name);
      if (!converted.markdown.trim()) throw new Error(converted.warnings[0] ?? "No text found");
      const dest = mdPathFor(path);
      await writeConverted(dest, converted);
      result.converted.push(dest);
      dirs.add(dirname(dest));
    } catch (e) {
      const reason = (e as Error)?.message ?? String(e);
      b.log("warn", "batch.convert", `${name}: ${reason}`);
      result.failed.push({ path, reason });
    }
  }
  for (const dir of dirs) await refreshDir(dir);

  const n = result.converted.length;
  const failed = result.failed.length;
  const summary = `Converted ${n} document${n === 1 ? "" : "s"} to Markdown`;
  if (failed) {
    const names = result.failed.slice(0, 3).map((f) => `“${basename(f.path)}”`).join(", ");
    notify(n ? "warning" : "error", `${summary}; ${failed} failed (${names}${failed > 3 ? ", …" : ""}).`);
  } else notify("success", `${summary}.`);
  return result;
}
