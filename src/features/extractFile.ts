import { backend } from "../services";
import { describeError, toAppError } from "../services/errors";
import { basename, dirname, isInside } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify, promptText } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { suggestedFileName } from "./documents";
import { getEditorView } from "./editorBridge";
import { extractHeadings } from "./outline";
import { refreshDir } from "./workspace";

/** The link that replaces moved text: its first heading (or the file name) pointing at the new file. */
export function extractedLink(text: string, fileName: string): string {
  const title = extractHeadings(text)[0]?.text ?? fileName.replace(/\.(md|markdown)$/i, "");
  return `[${title.replace(/[[\]]/g, "\\$&")}](${encodeURI(fileName).replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
}

/**
 * Move Selection to New File…: the selected text becomes a new Markdown file
 * in the document's folder (named after its first heading), and a link to it
 * takes its place. Relative links in the text keep working (same folder).
 */
export async function moveSelectionToNewFile() {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  const range = view.state.selection.main;
  if (range.empty) {
    notify("info", "Select the text to move to a new file.");
    return;
  }
  if (!doc.path) {
    notify("info", "Save the document first, so the new file can go next to it.");
    return;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  const heading = extractHeadings(text)[0]?.text;
  const suggested = suggestedFileName(heading ? `# ${heading}` : "", "untitled.md");
  const name = await promptText({
    title: "Move to New File",
    message: "The selected text moves to a new file in the same folder, and a link to it takes its place.",
    value: suggested,
    okLabel: "Move",
    selectUntil: suggested.replace(/\.md$/, "").length,
  });
  if (!name) return;
  const fileName = /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
  const dir = dirname(doc.path);
  const b = backend();
  let path: string;
  try {
    path = await b.createFile(dir, fileName);
  } catch (e) {
    notify("error", toAppError(e).kind === "alreadyExists" ? `“${fileName}” already exists. Choose another name.` : describeError(e, `create “${fileName}”`));
    return;
  }
  try {
    await b.writeTextFile({ path, content: text.trim() + "\n", lineEnding: doc.lineEnding, bom: false, expectedMtime: null, force: true });
  } catch (e) {
    notify("error", describeError(e, `write “${fileName}”`));
    return;
  }
  // The text may have changed while the name was being typed: then it stays, and the file is still there.
  if (view.state.sliceDoc(range.from, range.to) !== text) {
    notify("warning", `Created ${basename(path)}, but the selected text changed meanwhile, so it wasn't replaced with a link.`);
  } else {
    // Blank lines around the selection stay, so the link doesn't join the next heading or paragraph.
    const lead = /^\s*/.exec(text)![0];
    const trail = text.trim() ? /\s*$/.exec(text)![0] : "";
    const link = extractedLink(text, basename(path));
    view.dispatch({ changes: { from: range.from, to: range.to, insert: lead + link + trail }, selection: { anchor: range.from + lead.length + link.length }, userEvent: "input" });
    view.focus();
    notify("success", `Moved to ${basename(path)}.`);
  }
  const root = useWorkspace.getState().root;
  if (root && isInside(dir, root)) await refreshDir(dir);
}
