/**
 * Keyboard shortcuts, read at build time from the application's command
 * definitions (src/features/commands/*.ts) with the TypeScript parser, so the
 * reference always matches the app. "Mod" is Ctrl on Windows/Linux and Cmd on
 * macOS; a conditional such as `isMac ? "Mod+Alt+F" : "Mod+H"` gives the
 * macOS and Windows/Linux variants.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type TS from "typescript";

// The website's own TypeScript (5.x, with the compiler API), not the app's.
const ts: typeof TS = createRequire(new URL("../../../website/package.json", import.meta.url))("typescript");

export interface Shortcut {
  id: string;
  label: string;
  windows: string;
  mac: string;
  group: string;
}

declare const data: Shortcut[];
export { data };

/** The command definitions, one file per area (formatting first, as in the tables). */
const SOURCE_DIR = "../../../src/features/commands/";
const SOURCES = ["format.ts", "document.ts", "edit.ts", "view.ts", "ai.ts", "help.ts"].map((f) => SOURCE_DIR + f);

/** Human-readable keys: "Mod+Shift+P" -> "Ctrl+Shift+P" / "Cmd+Shift+P". */
function display(shortcut: string, mac: boolean) {
  return shortcut
    .split("+")
    .map((k) => {
      if (k === "Mod") return mac ? "Cmd" : "Ctrl";
      if (k === "Alt") return mac ? "Option" : "Alt";
      if (k === "Ctrl") return "Ctrl";
      if (k === "") return "+";
      return k.length === 1 ? k.toUpperCase() : k;
    })
    .join("+")
    .replace("++", "+Plus");
}

function literal(node: TS.Expression | undefined): { win: string; mac: string } | null {
  if (!node) return null;
  if (ts.isStringLiteral(node)) return { win: node.text, mac: node.text };
  if (ts.isConditionalExpression(node) && ts.isStringLiteral(node.whenTrue) && ts.isStringLiteral(node.whenFalse)) {
    // `isMac ? macKey : otherKey`
    return { mac: node.whenTrue.text, win: node.whenFalse.text };
  }
  return null;
}

export default {
  watch: SOURCES,
  load(): Shortcut[] {
    const out: Shortcut[] = [];
    let group = "";
    const visit = (node: TS.Node) => {
      // Which exported table a command belongs to: formatCommands (Format) or another …Commands table (App).
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        if (node.name.text === "formatCommands") group = "format";
        else if (/Commands$/.test(node.name.text)) group = "app";
      }
      // formatCommand("id", "Label", command, "Shortcut")
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "formatCommand") {
        const [id, label, , key] = node.arguments;
        const keys = literal(key);
        if (id && label && ts.isStringLiteral(id) && ts.isStringLiteral(label) && keys) {
          out.push({ id: id.text, label: label.text, windows: display(keys.win, false), mac: display(keys.mac, true), group: "format" });
        }
      }
      // { id: "save", label: "Save", shortcut: "Mod+S", ... }
      if (ts.isObjectLiteralExpression(node) && group === "app") {
        const prop = (name: string) =>
          node.properties.find((p): p is TS.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)?.initializer;
        const id = prop("id");
        const label = prop("label");
        const keys = literal(prop("shortcut"));
        if (id && label && ts.isStringLiteral(id) && ts.isStringLiteral(label) && keys) {
          out.push({ id: id.text, label: label.text.replace(/…$/, ""), windows: display(keys.win, false), mac: display(keys.mac, true), group: "app" });
        }
      }
      ts.forEachChild(node, visit);
    };
    for (const source of SOURCES) {
      const path = fileURLToPath(new URL(source, import.meta.url));
      group = "";
      visit(ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true));
    }
    if (out.length < 30) throw new Error(`Only ${out.length} shortcuts were found in ${SOURCE_DIR}; has its structure changed?`);
    return out;
  },
};
