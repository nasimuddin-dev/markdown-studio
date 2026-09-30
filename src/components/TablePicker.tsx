import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MAX = 8;

/**
 * Table size picker for the toolbar: hover over the grid and click, or type
 * the numbers of columns and rows and press Insert. Rows include the header
 * row, as in word processors. Escape or a click outside closes it.
 */
export function TablePicker({ x, y, onPick, onClose }: { x: number; y: number; onPick(columns: number, bodyRows: number): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState({ columns: 3, rows: 3 });
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), top: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
    first.current?.focus();
    first.current?.select();
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const clamp = (n: number, min: number) => Math.max(min, Math.min(20, Math.round(n) || min));
  const pick = () => onPick(size.columns, size.rows - 1);

  return (
    <div
      ref={ref}
      className="table-picker"
      role="dialog"
      aria-label="Insert table"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="table-picker-grid" aria-hidden="true">
        {Array.from({ length: MAX * MAX }, (_, i) => {
          const column = (i % MAX) + 1;
          const row = Math.floor(i / MAX) + 1;
          const on = column <= size.columns && row <= size.rows;
          return (
            <div
              key={i}
              className={`table-picker-cell${on ? " on" : ""}`}
              onMouseEnter={() => setSize({ columns: column, rows: Math.max(2, row) })}
              onClick={() => onPick(column, Math.max(2, row) - 1)}
            />
          );
        })}
      </div>
      <form
        className="table-picker-fields"
        onSubmit={(e) => {
          e.preventDefault();
          pick();
        }}
      >
        <label>
          Columns
          <input ref={first} className="text-input" type="number" min={1} max={20} value={size.columns} onChange={(e) => setSize({ ...size, columns: clamp(Number(e.target.value), 1) })} />
        </label>
        <label>
          Rows
          <input className="text-input" type="number" min={2} max={20} value={size.rows} onChange={(e) => setSize({ ...size, rows: clamp(Number(e.target.value), 2) })} />
        </label>
        <button type="submit" className="button primary">Insert</button>
      </form>
    </div>
  );
}
