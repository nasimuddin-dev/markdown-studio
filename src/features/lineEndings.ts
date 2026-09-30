import type { LineEnding } from "../types";
import { activeDoc, isDirty, useDocuments } from "../stores/documentsStore";
import { notify } from "../stores/uiStore";
import { saveDocument } from "./documents";

const LABEL: Record<LineEnding, string> = { lf: "LF", crlf: "CRLF" };

/**
 * Changes the active document's line endings. A saved document without other
 * changes is saved right away, so the file on disk changes too; otherwise the
 * new line endings are used at the next save.
 */
export async function setLineEnding(ending: LineEnding) {
  const doc = activeDoc();
  if (!doc || doc.lineEnding === ending) return;
  useDocuments.getState().update(doc.id, { lineEnding: ending });
  if (doc.path && !isDirty(doc) && !doc.readOnly) {
    if (await saveDocument(doc.id)) notify("success", `Saved with ${LABEL[ending]} line endings.`);
  } else {
    notify("info", `${LABEL[ending]} line endings will be used when the document is saved.`);
  }
}
