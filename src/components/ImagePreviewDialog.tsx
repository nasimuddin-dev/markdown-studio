import { useEffect, useState } from "react";
import { backend } from "../services";
import { basename } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { insertFileLink } from "../features/pathActions";
import { Modal } from "./Dialogs";

/** A picture opened from the Explorer (with a button to link it in the document) or from the preview. */
export function ImagePreviewDialog() {
  const path = useUi((s) => s.imagePreview);
  const offerInsert = useUi((s) => s.imagePreviewInsert);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    backend()
      .readImage(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!path) return null;
  const close = () => useUi.getState().setImagePreview(null);
  const doc = activeDoc();
  return (
    <Modal title={basename(path)} onClose={close} className="image-preview-modal">
      <div className="image-preview">
        {url ? <img src={url} alt={basename(path)} /> : <p className="muted">{failed ? "The picture couldn't be read." : "Loading…"}</p>}
      </div>
      <p className="muted small">{path}</p>
      <div className="modal-buttons">
        <button className="button" onClick={close}>
          Close
        </button>
        {offerInsert && (
          <button
            className="button primary"
            disabled={!doc?.path}
            title={doc?.path ? undefined : "Open a saved document to link the picture in it"}
            onClick={() => {
              close();
              insertFileLink(path);
            }}
            data-autofocus
          >
            Insert Link in Document
          </button>
        )}
      </div>
    </Modal>
  );
}
