/** YAML front matter (`---` … `---` or `...`) at the very start of a document. */
const FRONT_MATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export interface FrontMatter {
  /** The whole block, including the delimiters. */
  raw: string;
  /** Top-level keys and a readable value (lists joined with ", "). */
  entries: Array<[string, string]>;
  /** The document with the block replaced by blank lines (line numbers are kept). */
  body: string;
}

const unquote = (v: string) => {
  const t = v.trim();
  if (/^"(.*)"$/.test(t)) return t.slice(1, -1).replace(/\\"/g, '"');
  if (/^'(.*)'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  return t;
};

/**
 * Reads simple YAML metadata for display: `key: value`, flow lists
 * (`[a, b]`), block lists (`- a`), block scalars (`|`, `>`) and nested maps
 * (shown as `sub: value`). It never executes anything and isn't a full YAML
 * parser; unusual syntax is shown as written.
 */
export function parseFrontMatterEntries(yaml: string): Array<[string, string]> {
  const entries: Array<[string, string[], "list" | "text" | "map"]> = [];
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const top = /^([^\s#:-][^:]*?):(?:\s+(.*))?\s*$/.exec(line);
    if (top) {
      const value = (top[2] ?? "").replace(/\s+#.*$/, "");
      if (/^\[.*\]$/.test(value)) {
        entries.push([top[1], value.slice(1, -1).split(",").map(unquote).filter(Boolean), "list"]);
      } else if (/^[|>][-+]?$/.test(value) || value === "") {
        entries.push([top[1], [], value.startsWith(">") ? "text" : value.startsWith("|") ? "text" : "map"]);
      } else {
        entries.push([top[1], [unquote(value)], "text"]);
      }
      continue;
    }
    const last = entries.at(-1);
    if (!last) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      last[1].push(unquote(item[1]));
      last[2] = "list";
    } else {
      const nested = /^\s+([^\s:][^:]*?):\s*(.*)$/.exec(line);
      if (nested && last[2] === "map") last[1].push(`${nested[1]}: ${unquote(nested[2])}`);
      else last[1].push(line.trim());
    }
  }
  return entries.map(([k, v, kind]) => [k, v.join(kind === "list" ? ", " : kind === "map" ? "; " : " ")]);
}

export function splitFrontMatter(text: string): FrontMatter | null {
  const m = FRONT_MATTER.exec(text);
  if (!m) return null;
  const raw = m[0];
  const lines = raw.split("\n").length - (raw.endsWith("\n") ? 1 : 0);
  return { raw, entries: parseFrontMatterEntries(m[1] ?? ""), body: "\n".repeat(lines) + text.slice(raw.length) };
}

/** The document without its front matter (for exports). */
export function stripFrontMatter(text: string): string {
  const m = FRONT_MATTER.exec(text);
  return m ? text.slice(m[0].length).replace(/^\s*\n/, "") : text;
}

/** Document properties for exports, from the front matter. */
export interface DocumentMetadata {
  author?: string;
  description?: string;
  keywords?: string;
}

/**
 * `author`/`authors`, `description`/`summary`/`subject` and `keywords`/`tags`
 * from the front matter (lists are joined with ", "), for the document
 * properties of exported files.
 */
export function frontMatterMetadata(text: string): DocumentMetadata {
  const entries = splitFrontMatter(text)?.entries ?? [];
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = entries.find(([k]) => k.toLowerCase() === key)?.[1].trim();
      if (value) return value.slice(0, 1000);
    }
    return undefined;
  };
  const meta: DocumentMetadata = {};
  const author = pick("author", "authors");
  const description = pick("description", "summary", "subject");
  const keywords = pick("keywords", "tags");
  if (author) meta.author = author;
  if (description) meta.description = description;
  if (keywords) meta.keywords = keywords;
  return meta;
}

/** The `title` entry of the front matter, if any. */
export function frontMatterTitle(text: string): string | null {
  const fm = splitFrontMatter(text);
  const title = fm?.entries.find(([k]) => k.toLowerCase() === "title")?.[1].trim();
  return title || null;
}
