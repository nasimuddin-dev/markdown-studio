import type { LineEnding } from "../types";
import { activeDoc, isDirty, useDocuments } from "../stores/documentsStore";
import { notify } from "../stores/uiStore";
import { saveDocument } from "./documents";

const LABEL: Record<LineEnding, string> = { lf: "LF", crlf: "CRLF" };

/**
 * Applies a change to how the active document is written (line endings,
 * byte order mark). A saved document without other changes is saved right
 * away, so the file on disk changes too; otherwise it applies at the next save.
 */
async function changeFormat(patch: { lineEnding?: LineEnding; bom?: boolean }, what: string) {
  const doc = activeDoc();
  if (!doc) return;
  if ((patch.lineEnding ?? doc.lineEnding) === doc.lineEnding && (patch.bom ?? doc.bom) === doc.bom) return;
  useDocuments.getState().update(doc.id, patch);
  if (doc.path && !isDirty(doc) && !doc.readOnly) {
    if (await saveDocument(doc.id)) notify("success", `Saved with ${what}.`);
  } else {
    notify("info", `${what[0].toUpperCase()}${what.slice(1)} will be used when the document is saved.`);
  }
}

/** Changes the active document's line endings (LF or CRLF). */
export const setLineEnding = (ending: LineEnding) => changeFormat({ lineEnding: ending }, `${LABEL[ending]} line endings`);

/** Saves the active document as UTF-8 with or without a byte order mark. */
export const setBom = (bom: boolean) => changeFormat({ bom }, bom ? "UTF-8 with BOM encoding" : "UTF-8 encoding (no BOM)");
