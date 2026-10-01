import { useEffect, useState } from "react";
import { backend } from "../services";
import { FEEDBACK_KINDS, feedbackReport, issueUrl, technicalDetails, type FeedbackKind } from "../services/feedback";
import { recentErrors } from "../features/errorReports";
import { notify, useUi } from "../stores/uiStore";
import { Modal } from "./Dialogs";

/**
 * Help → Send Feedback / Report a Problem. The user writes a suggestion, a
 * problem or an opinion, sees exactly what will be included, and opens it as a
 * new GitHub issue in the browser (or copies it). Nothing is sent by Markpion.
 */
export function FeedbackDialog() {
  const request = useUi((s) => s.feedback);
  const close = useUi((s) => s.closeFeedback);
  const [kind, setKind] = useState<FeedbackKind>(request?.kind ?? "suggestion");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [includeTechnical, setIncludeTechnical] = useState(request?.kind === "problem");
  const [technical, setTechnical] = useState("");

  useEffect(() => {
    let cancelled = false;
    const errors = request?.error ? [request.error] : recentErrors();
    backend()
      .appInfo()
      .catch(() => ({ version: "unknown", os: "unknown", arch: "unknown" }))
      .then((info) => !cancelled && setTechnical(technicalDetails(info, errors)));
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (!request) return null;
  const report = () => feedbackReport({ kind, summary, details, technical: includeTechnical ? technical : undefined });
  const fullText = () => {
    const { title, body } = report();
    return `${title}\n\n${body}`;
  };

  const openOnGitHub = async () => {
    const { title, body } = report();
    const { url, shortened } = issueUrl(title, body);
    try {
      if (shortened) await navigator.clipboard.writeText(fullText());
      await backend().openExternal(url);
      notify("success", shortened ? "Opened on GitHub, shortened to fit. The full text is on the clipboard." : "Opened on GitHub. Review it there and submit it.");
      close();
    } catch (e) {
      notify("error", `Couldn't open the browser: ${(e as Error).message}`);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText());
      notify("success", "Feedback copied.");
    } catch (e) {
      notify("error", `Couldn't copy: ${(e as Error).message}`);
    }
  };

  return (
    <Modal title={request.kind === "problem" ? "Report a Problem" : "Send Feedback"} onClose={close} className="feedback-modal">
      <p className="modal-message">
        Thank you for helping improve Markpion. Your feedback opens as a new issue on GitHub in your browser, where you can review it before submitting (a free GitHub account is needed). Nothing is sent from Markpion itself.
      </p>
      <fieldset className="settings-choice">
        <legend>What kind of feedback?</legend>
        {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
          <label key={k} className="check">
            <input type="radio" name="feedback-kind" value={k} checked={kind === k} onChange={() => {
              setKind(k);
              if (k === "problem") setIncludeTechnical(true);
            }} />
            {FEEDBACK_KINDS[k].label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="feedback-summary">Summary</label>
      <input id="feedback-summary" className="text-input" data-autofocus value={summary} maxLength={120} onChange={(e) => setSummary(e.target.value)} placeholder="In a few words" />
      <label htmlFor="feedback-details">Details</label>
      <textarea id="feedback-details" className="text-input" rows={6} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={FEEDBACK_KINDS[kind].placeholder} />
      <label className="check feedback-technical">
        <input type="checkbox" checked={includeTechnical} onChange={(e) => setIncludeTechnical(e.target.checked)} />
        Include technical details (you can edit them)
      </label>
      {includeTechnical && (
        <textarea aria-label="Technical details" className="text-input code-input" rows={5} value={technical} onChange={(e) => setTechnical(e.target.value)} spellCheck={false} />
      )}
      <div className="modal-buttons">
        <div className="modal-buttons-start">
          <button className="button" onClick={() => void copy()} disabled={!summary.trim()}>Copy Text</button>
        </div>
        <button className="button" onClick={close}>Cancel</button>
        <button className="button primary" onClick={() => void openOnGitHub()} disabled={!summary.trim()}>Open on GitHub</button>
      </div>
    </Modal>
  );
}
