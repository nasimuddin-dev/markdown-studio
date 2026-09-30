import { useEffect, useMemo, useState } from "react";
import { useUi, notify } from "../stores/uiStore";
import { useDocuments } from "../stores/documentsStore";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename } from "../services/paths";
import { diffLines, diffStats } from "../features/diff";
import { openPath } from "../features/documents";
import { DiffRows } from "./DiffView";
import { Modal } from "./Dialogs";

/** Line diff between the active document (as edited) and another file on disk. */
export function CompareDialog() {
  const compare = useUi((s) => s.compare);
  const close = () => useUi.getState().setCompare(null);
  const doc = useDocuments((s) => s.docs.find((d) => d.id === compare?.docId));
  const [other, setOther] = useState<string | null>(null);

  useEffect(() => {
    setOther(null);
    if (!compare) return;
    let cancelled = false;
    // An open tab shows its current (possibly unsaved) text; otherwise the file on disk.
    const open = useDocuments.getState().docs.find((d) => d.path === compare.path);
    if (open) setOther(open.content);
    else
      backend()
        .readTextFile(compare.path)
        .then((f) => !cancelled && setOther(f.content))
        .catch((e) => {
          notify("error", describeError(e, `read “${basename(compare.path)}”`));
          useUi.getState().setCompare(null);
        });
    return () => {
      cancelled = true;
    };
  }, [compare]);

  const diff = useMemo(() => (other !== null && doc ? diffLines(other, doc.content) : null), [other, doc?.content]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!compare || !doc) return null;
  const otherName = basename(compare.path);
  const stats = diff ? diffStats(diff) : null;

  return (
    <Modal title={`Compare — ${doc.name} and ${otherName}`} onClose={close} className="history-modal compare-modal">
      <div className="history-diff compare-diff" aria-label={`Differences between ${otherName} and ${doc.name}`}>
        {other === null ? (
          <p className="muted">Loading…</p>
        ) : diff === null ? (
          <p className="muted">These documents are too large to compare.</p>
        ) : stats && stats.added + stats.removed === 0 ? (
          <p className="muted">The two documents are identical.</p>
        ) : (
          <>
            <p className="history-legend">
              <span className="diff-del-chip">− {stats!.removed} only in {otherName}</span>{" "}
              <span className="diff-add-chip">+ {stats!.added} only in {doc.name}</span>
            </p>
            <DiffRows lines={diff} />
          </>
        )}
      </div>
      <div className="modal-buttons">
        <button
          className="button"
          onClick={() => {
            close();
            void openPath(compare.path);
          }}
        >
          Open {otherName}
        </button>
        <button className="button primary" onClick={close}>Close</button>
      </div>
    </Modal>
  );
}
