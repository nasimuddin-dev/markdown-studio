import { useEffect, useState } from "react";
import { useAi, type AiPlacement } from "../stores/aiStore";
import { notify } from "../stores/uiStore";
import { applyAiReview, cancelAiRequest } from "../features/ai";
import { Modal } from "./Dialogs";

/** "Claude is working…" while an AI request runs, with Cancel. */
function AiBusy() {
  const busy = useAi((s) => s.busy);
  const reviewing = useAi((s) => !!s.review);
  // Once the review opens, it shows the progress itself.
  if (!busy || reviewing) return null;
  return (
    <div className="ai-busy" role="status" aria-live="polite">
      <span className="ai-spinner" aria-hidden="true" />
      <span>Claude is working on “{busy.label}”…</span>
      <button className="button small" onClick={cancelAiRequest}>
        Cancel
      </button>
    </div>
  );
}

const PRIMARY_LABEL: Record<AiPlacement, string> = { replace: "Replace", below: "Insert Below", cursor: "Insert" };

/** Shows an AI answer next to the original text; nothing changes until the user applies it. */
function AiReviewDialog() {
  const review = useAi((s) => s.review);
  const [text, setText] = useState("");
  useEffect(() => setText(review?.suggestion ?? ""), [review]);
  if (!review) return null;
  const streaming = !!review.streaming;
  // Closing while Claude is still writing stops the request.
  const close = () => (streaming ? cancelAiRequest() : useAi.getState().setReview(null));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify("success", "Suggestion copied.");
      close();
    } catch {
      notify("error", "Couldn't copy to the clipboard.");
    }
  };
  // Replace-type answers can also go below the original; summaries can also replace it.
  const alternative: AiPlacement | null = review.placement === "replace" ? "below" : review.placement === "below" ? "replace" : null;
  return (
    <Modal title={`AI: ${review.label}`} onClose={close} className="ai-review-modal">
      <div className="ai-review">
        {review.original && (
          <section>
            <h3 id="ai-original-label">Original</h3>
            <pre className="ai-original" aria-labelledby="ai-original-label" tabIndex={0}>
              {review.original}
            </pre>
          </section>
        )}
        <section>
          <h3>
            <label htmlFor="ai-suggestion">{streaming ? "Claude is writing…" : "Suggestion (you can edit it before applying)"}</label>
          </h3>
          <textarea
            id="ai-suggestion"
            className="ai-suggestion"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={streaming}
            aria-busy={streaming}
            spellCheck
            data-autofocus
          />
        </section>
        <p className="muted small">Written by Claude. Check it before you use it.</p>
      </div>
      <div className="modal-buttons">
        <button className="button" onClick={close}>
          {streaming ? "Stop" : "Discard"}
        </button>
        <button className="button" onClick={() => void copy()} disabled={streaming}>
          Copy
        </button>
        {alternative && (
          <button className="button" onClick={() => applyAiReview(alternative, text)} disabled={streaming}>
            {PRIMARY_LABEL[alternative]}
          </button>
        )}
        <button className="button primary" onClick={() => applyAiReview(review.placement, text)} disabled={streaming || !text.trim()}>
          {PRIMARY_LABEL[review.placement]}
        </button>
      </div>
    </Modal>
  );
}

export function AiPanel() {
  return (
    <>
      <AiBusy />
      <AiReviewDialog />
    </>
  );
}
