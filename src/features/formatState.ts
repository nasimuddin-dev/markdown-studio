import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

/** The Markdown formatting at the cursor, for the toolbar's pressed buttons. */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  link: boolean;
  /** 0 for normal text, else the heading level. */
  heading: number;
  list: "bullet" | "ordered" | "task" | null;
  quote: boolean;
  codeBlock: boolean;
  table: boolean;
}

export const NO_FORMAT: FormatState = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  link: false,
  heading: 0,
  list: null,
  quote: false,
  codeBlock: false,
  table: false,
};

const INLINE: Record<string, keyof FormatState> = {
  StrongEmphasis: "bold",
  Emphasis: "italic",
  Strikethrough: "strikethrough",
  InlineCode: "code",
  Link: "link",
  Autolink: "link",
};

/**
 * Reads the formatting at the cursor from the Markdown syntax tree. Inline
 * marks count only strictly inside them (typing right after `**bold**` isn't
 * bold); block formats count anywhere in the block.
 */
export function formatStateAt(state: EditorState): FormatState {
  const pos = state.selection.main.head;
  const out: FormatState = { ...NO_FORMAT };
  const seen = new Set<number>();
  for (const side of [-1, 1] as const) {
    let task = false;
    for (let node: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) {
      if (seen.has(node.from * 1e6 + node.to + node.type.id)) continue;
      seen.add(node.from * 1e6 + node.to + node.type.id);
      const name = node.name;
      const inline = INLINE[name];
      if (inline) {
        if (node.from < pos && pos < node.to) (out as unknown as Record<string, boolean>)[inline] = true;
        continue;
      }
      if (pos < node.from || pos > node.to) continue;
      if (name === "Blockquote") out.quote = true;
      else if (name === "FencedCode" || name === "CodeBlock") out.codeBlock = true;
      else if (name === "Table") out.table = true;
      else if (name === "Task") task = true;
      else if (!out.heading && /^(ATX|Setext)Heading\d$/.test(name)) out.heading = Number(name.slice(-1));
      else if (!out.list && name === "BulletList") out.list = task ? "task" : "bullet";
      else if (!out.list && name === "OrderedList") out.list = "ordered";
    }
  }
  return out;
}
