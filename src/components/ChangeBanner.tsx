import { useDocuments, isDirty } from "../stores/documentsStore";
import { closeDocument, keepMine, openDiskVersion, reloadDocument, saveDocument, setReadOnly } from "../features/documents";
import { Icon } from "./Icon";

/** Notifies the user about external changes to the active file (FR-018, SRS §12), or that it's read-only. */
export function ChangeBanner() {
  const doc = useDocuments((s) => s.docs.find((d) => d.id === s.activeId));
  if (!doc) return null;
  if (!doc.externalChange && doc.readOnly) {
    return (
      <div className="banner info" role="status">
        <Icon name="lock" />
        <span className="banner-text">
          {doc.readOnly === "file"
            ? `“${doc.name}” is read-only on disk, so editing is locked. Use Save As to keep a changed copy.`
            : `“${doc.name}” is read-only (View → Toggle Read-Only).`}
        </span>
        {doc.readOnly === "file" && <button className="button" onClick={() => void saveDocument(doc.id, { saveAs: true })}>Save As…</button>}
        <button className="button" onClick={() => setReadOnly(doc.id, false)}>{doc.readOnly === "file" ? "Edit Anyway" : "Allow Editing"}</button>
      </div>
    );
  }
  if (!doc.externalChange) return null;

  if (doc.externalChange === "deleted") {
    return (
      <div className="banner warning" role="alert">
        <Icon name="warning" />
        <span className="banner-text">“{doc.name}” was deleted or moved outside Markpion. Your text is still here.</span>
        <button className="button" onClick={() => void saveDocument(doc.id)}>Save to Recreate</button>
        <button className="button" onClick={() => void saveDocument(doc.id, { saveAs: true })}>Save As…</button>
        <button className="button" onClick={() => void closeDocument(doc.id)}>Close</button>
      </div>
    );
  }
  return (
    <div className="banner warning" role="alert">
      <Icon name="warning" />
      <span className="banner-text">
        “{doc.name}” changed on disk{isDirty(doc) ? " and you have unsaved changes" : ""}.
      </span>
      <button className="button" onClick={() => void reloadDocument(doc.id)}>Reload (discard mine)</button>
      <button className="button" onClick={() => void openDiskVersion(doc.id)}>Compare</button>
      <button className="button primary" onClick={() => void keepMine(doc.id)}>Keep Mine</button>
    </div>
  );
}
