/**
 * Feedback and problem reports. Markpion sends nothing by itself: a report is
 * text the user reads and edits, then opens as a new GitHub issue in their
 * browser (where they review and submit it) or copies to send another way.
 */

export type FeedbackKind = "suggestion" | "problem" | "design";

export const FEEDBACK_KINDS: Record<FeedbackKind, { label: string; title: string; placeholder: string }> = {
  suggestion: {
    label: "Suggestion or idea",
    title: "Suggestion",
    placeholder: "What would you like Markpion to do, and what would it help you with?",
  },
  problem: {
    label: "Problem or error",
    title: "Problem",
    placeholder: "What did you do, what happened, and what did you expect to happen?",
  },
  design: {
    label: "Opinion on the design or workflow",
    title: "Design",
    placeholder: "What felt awkward, slow or unclear, and what would work better for you?",
  },
};

export const NEW_ISSUE_URL = "https://github.com/nasimuddin-dev/markpion/issues/new";

/** An error worth mentioning in a report: where it happened and what it said. */
export interface ReportedError {
  message: string;
  /** The part of the app ("preview", "window"), when known. */
  area?: string;
  stack?: string;
  /** ISO time it happened. */
  time?: string;
}

/** Version and system lines, and the errors, as plain text the user can read and edit before sending. */
export function technicalDetails(info: { version: string; os: string; arch: string }, errors: ReportedError[] = []): string {
  const lines = [`Markpion ${info.version}`, `System: ${info.os} (${info.arch})`];
  for (const e of errors) {
    lines.push("", `Error${e.area ? ` in the ${e.area}` : ""}${e.time ? ` at ${e.time}` : ""}: ${e.message}`);
    // The first lines of the stack are enough to find the place in the code.
    if (e.stack) lines.push(...e.stack.split("\n").slice(0, 6).map((l) => `    ${l.trim()}`));
  }
  return lines.join("\n");
}

/** The issue's title and body. */
export function feedbackReport(input: { kind: FeedbackKind; summary: string; details: string; technical?: string }): { title: string; body: string } {
  const title = `[${FEEDBACK_KINDS[input.kind].title}] ${input.summary.trim()}`;
  const parts = [input.details.trim() || "(no details given)"];
  if (input.technical?.trim()) parts.push("### Technical details", "```text\n" + input.technical.trim() + "\n```");
  parts.push("_Sent with Markpion's Send Feedback. A diagnostic log (Help → Export Diagnostic Logs) can be attached here if it helps._");
  return { title, body: parts.join("\n\n") };
}

/** GitHub doesn't open issue links much longer than about 8,000 characters. */
const MAX_URL = 7500;

/**
 * A link that opens a new GitHub issue with this title and body filled in. A
 * long body is shortened to fit (`shortened`), and the caller puts the full
 * text on the clipboard.
 */
export function issueUrl(title: string, body: string): { url: string; shortened: boolean } {
  const make = (b: string) => `${NEW_ISSUE_URL}?${new URLSearchParams({ title, body: b }).toString()}`;
  let url = make(body);
  if (url.length <= MAX_URL) return { url, shortened: false };
  const note = "\n\n_(Shortened to fit in a link: paste the full text from the clipboard here.)_";
  let keep = body.length;
  while (keep > 0 && url.length > MAX_URL) {
    keep = Math.floor(keep * 0.9);
    url = make(body.slice(0, keep) + note);
  }
  return { url, shortened: true };
}
