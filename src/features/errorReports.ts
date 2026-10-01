import { backend } from "../services";
import { feedbackReport, issueUrl, technicalDetails, type ReportedError } from "../services/feedback";
import { useUi } from "../stores/uiStore";

/**
 * The last few unexpected errors (uncaught exceptions, rejected promises,
 * components that failed to render), kept in memory only, so a problem report
 * can mention them. Nothing leaves the computer unless the user sends a report.
 */
const MAX = 5;
const recent: ReportedError[] = [];

export function recordError(error: unknown, area?: string) {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));
  if (!e.message && !e.stack) return;
  recent.push({ message: e.message || String(e), area, stack: e.stack, time: new Date().toISOString() });
  if (recent.length > MAX) recent.shift();
}

export function recentErrors(): ReportedError[] {
  return [...recent];
}

/** For tests. */
export function clearRecentErrors() {
  recent.length = 0;
}

let installed = false;
/** Records uncaught errors and rejected promises from now on. */
export function installErrorCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => recordError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => recordError(e.reason));
}

/** Opens Send Feedback as a problem report about `error` (or the recent errors). */
export function reportProblem(error?: ReportedError) {
  useUi.getState().openFeedback({ kind: "problem", error });
}

/**
 * When the whole window failed and no dialog can be shown: opens a problem
 * report on GitHub directly, with the error filled in for the user to review.
 */
export async function reportCrash(error: Error) {
  recordError(error, "window");
  const info = await backend().appInfo().catch(() => ({ version: "unknown", os: "unknown", arch: "unknown" }));
  const { title, body } = feedbackReport({
    kind: "problem",
    summary: `The window stopped with an error: ${error.message}`.slice(0, 120),
    details: "What were you doing when this happened?",
    technical: technicalDetails(info, recentErrors()),
  });
  const { url, shortened } = issueUrl(title, body);
  if (shortened) await navigator.clipboard?.writeText(`${title}\n\n${body}`).catch(() => {});
  await backend().openExternal(url);
}
