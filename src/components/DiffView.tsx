import { useMemo } from "react";
import { pairedWordDiffs, withContext, type DiffLine } from "../features/diff";

/**
 * A line diff with unchanged runs collapsed; changes are announced to screen
 * readers as added/removed. In a changed line, the words that differ from its
 * other version are highlighted.
 */
export function DiffRows({ lines }: { lines: DiffLine[] }) {
  const words = useMemo(() => pairedWordDiffs(lines), [lines]);
  return (
    <pre className="diff">
      {withContext(lines).map((row, i) =>
        row.kind === "gap" ? (
          <div key={i} className="diff-gap">⋯ {row.hidden} unchanged line{row.hidden === 1 ? "" : "s"}</div>
        ) : (
          <div key={i} className={`diff-line diff-${row.kind}`}>
            <span className="diff-sign" aria-hidden="true">{row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}</span>
            <span className="sr-only">{row.kind === "add" ? "added: " : row.kind === "del" ? "removed: " : ""}</span>
            {words.get(row)?.map((s, k) => (s.changed ? <mark key={k} className="diff-word">{s.text}</mark> : s.text)) ?? (row.text || " ")}
          </div>
        ),
      )}
    </pre>
  );
}
