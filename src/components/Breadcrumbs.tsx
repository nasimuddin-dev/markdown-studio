import { useDeferredValue, useMemo, useState, type MouseEvent } from "react";
import { extractHeadings } from "../features/outline";
import { headingParents, headingPath, siblingHeadings } from "../features/breadcrumbs";
import { useDocuments } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { goToHeading } from "./Outline";
import { Icon } from "./Icon";

/**
 * Where the cursor is in the document's headings, above the editor:
 * "notes.md › Guide › Install". Each part opens a list of the headings at
 * that level (under the same parent) to jump to.
 */
export function Breadcrumbs() {
  const name = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.name ?? "");
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content ?? "");
  const deferred = useDeferredValue(content);
  const cursorLine = useUi((s) => s.cursor.line);
  // From the text at a lower priority than typing, like the outline.
  const headings = useMemo(() => extractHeadings(deferred), [deferred]);
  const parents = useMemo(() => headingParents(headings), [headings]);
  const path = headingPath(headings, parents, cursorLine);
  const [menu, setMenu] = useState<{ x: number; y: number; of: number } | null>(null);

  const open = (e: MouseEvent<HTMLButtonElement>, of: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 2, of });
  };
  // The heading the crumb stands for is marked (for the file name, the top-level section the cursor is in).
  const entries = (of: number): MenuEntry[] => {
    const current = of < 0 ? path[0] : of;
    return siblingHeadings(parents, of).map((i) => ({
      label: `${i === current ? "• " : ""}${headings[i].text || "(empty heading)"}`,
      run: () => goToHeading(headings[i], i),
    }));
  };

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      <ol>
        <li>
          <button
            type="button"
            className="breadcrumb"
            title="Top-level headings"
            aria-haspopup="menu"
            disabled={!headings.length}
            onClick={(e) => open(e, -1)}
          >
            <Icon name="file" size={13} />
            <span>{name}</span>
          </button>
        </li>
        {path.map((i, depth) => (
          <li key={`${depth}-${i}`}>
            <Icon name="chevronRight" size={12} className="breadcrumb-sep" />
            <button
              type="button"
              className="breadcrumb"
              title="Headings at this level"
              aria-haspopup="menu"
              aria-current={depth === path.length - 1 ? "location" : undefined}
              onClick={(e) => open(e, i)}
            >
              <span>{headings[i].text || "(empty heading)"}</span>
            </button>
          </li>
        ))}
      </ol>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.of < 0 ? "Top-level headings" : "Headings at this level"}
          onClose={() => setMenu(null)}
          items={entries(menu.of)}
        />
      )}
    </nav>
  );
}
