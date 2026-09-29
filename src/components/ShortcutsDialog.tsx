import { useEffect, useMemo, useState } from "react";
import { ask, useUi } from "../stores/uiStore";
import { SHORTCUT, useSettings } from "../stores/settingsStore";
import { commandWithShortcut, commands, defaultShortcut, eventToShortcut, formatCommands, formatShortcut, type Command } from "../features/commands";
import { fuzzyFilter } from "../features/fuzzy";
import { Modal } from "./Dialogs";

const GROUPS: Array<{ title: string; ids: string[] }> = [
  { title: "File", ids: ["newFile", "openFile", "openFolder", "goToFile", "save", "saveAs", "saveAll", "fileHistory", "exportHtml", "print", "closeTab", "reopenClosedTab"] },
  { title: "Edit & Find", ids: ["undo", "redo", "find", "replace", "gotoLine", "findInFiles", "selectAll"] },
  { title: "Format", ids: [...Object.keys(formatCommands), "insertImage"] },
  {
    title: "View & Navigation",
    ids: ["commandPalette", "viewEditor", "viewSplit", "viewPreview", "toggleView", "toggleExplorer", "toggleOutline", "focusMode", "fullScreen", "presentSlides", "zoomIn", "zoomOut", "zoomReset", "nextTab", "prevTab", "settings"],
  },
  { title: "AI", ids: Object.keys(commands).filter((id) => id.startsWith("ai")) },
];

/** Every other command, so any of them can be given a shortcut. */
function otherCommandIds(): string[] {
  const listed = new Set(GROUPS.flatMap((g) => g.ids));
  return Object.keys(commands).filter((id) => !listed.has(id));
}

/** Modifier keys alone don't make a shortcut. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

/**
 * Help → Keyboard Shortcuts: a searchable list of commands and their
 * shortcuts, where each shortcut can be changed, removed or reset.
 */
export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  const keybindings = useSettings((s) => s.settings.keybindings);
  const update = useSettings((s) => s.update);
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState<string | null>(null);

  const groups = useMemo(() => {
    const all = [...GROUPS, { title: "Other commands", ids: otherCommandIds() }];
    const byGroup = all.map((g) => ({
      title: g.title,
      items: g.ids.map((id) => commands[id]).filter((c): c is Command => !!c),
    }));
    if (!query.trim()) return byGroup;
    return byGroup
      .map((g) => ({
        title: g.title,
        items: fuzzyFilter(g.items, query, (c) => `${c.label} ${formatShortcut(c.shortcut)}`).map((r) => r.item),
      }))
      .filter((g) => g.items.length > 0);
    // keybindings: re-read command.shortcut after a change.
  }, [query, keybindings]); // eslint-disable-line react-hooks/exhaustive-deps

  const setShortcut = (id: string, shortcut: string | null | undefined) => {
    const next = { ...keybindings };
    if (shortcut === undefined || shortcut === (defaultShortcut(id) ?? null)) delete next[id];
    else next[id] = shortcut;
    update({ keybindings: next });
  };

  // While recording, the next key combination becomes the command's shortcut.
  useEffect(() => {
    if (!recording) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") return setRecording(null);
      if (MODIFIER_KEYS.has(e.key)) return;
      const shortcut = eventToShortcut(e);
      const needsModifier = !/^F\d{1,2}$/.test(shortcut) && !/^(Mod|Ctrl|Alt)\+/.test(shortcut);
      if (needsModifier || !SHORTCUT.test(shortcut)) return; // keep listening for a usable combination
      const id = recording;
      setRecording(null);
      const other = commandWithShortcut(shortcut, id);
      if (other) {
        const choice = await ask({
          title: "Shortcut already in use",
          message: `${formatShortcut(shortcut)} is the shortcut for “${other.label.replace(/…$/, "")}”. Use it for “${commands[id].label.replace(/…$/, "")}” instead?`,
          buttons: [
            { id: "cancel", label: "Cancel" },
            { id: "replace", label: "Use It Here", variant: "primary" },
          ],
          cancelId: "cancel",
        });
        if (choice !== "replace") return;
        update({ keybindings: { ...useSettings.getState().settings.keybindings, [other.id]: null, [id]: shortcut } });
        return;
      }
      setShortcut(id, shortcut);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const changed = Object.keys(keybindings).length;
  return (
    <Modal title="Keyboard Shortcuts" onClose={() => (recording ? setRecording(null) : setOpen(false))} className="shortcuts-modal">
      <input
        className="text-input"
        placeholder="Filter commands"
        aria-label="Filter commands"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-autofocus
      />
      <p className="muted small">Choose Change, then press the new shortcut (Esc cancels). Shortcuts need Ctrl, Alt or Cmd, or a function key.</p>
      <div className="shortcuts-groups" tabIndex={0} role="region" aria-label="Shortcut list">
        {groups.length === 0 && <p className="muted">No matching commands.</p>}
        {groups.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <table className="shortcuts-table">
              <tbody>
                {g.items.map((c) => {
                  const label = c.label.replace(/…$/, "");
                  const custom = Object.hasOwn(keybindings, c.id);
                  return (
                    <tr key={c.id} className={custom ? "custom" : undefined}>
                      <td>{label}</td>
                      <td aria-live={recording === c.id ? "polite" : undefined}>
                        {recording === c.id ? (
                          <span className="recording">Press a shortcut…</span>
                        ) : c.shortcut ? (
                          <kbd>{formatShortcut(c.shortcut)}</kbd>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="shortcut-actions">
                        <button className="button small" onClick={() => setRecording(recording === c.id ? null : c.id)} aria-label={`Change shortcut for ${label}`}>
                          {recording === c.id ? "Cancel" : "Change"}
                        </button>
                        {c.shortcut && (
                          <button className="button small" onClick={() => setShortcut(c.id, null)} aria-label={`Remove shortcut for ${label}`}>
                            Remove
                          </button>
                        )}
                        {custom && (
                          <button className="button small" onClick={() => setShortcut(c.id, undefined)} aria-label={`Reset shortcut for ${label}`}>
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <div className="modal-buttons">
        {changed > 0 && (
          <button className="button" onClick={() => update({ keybindings: {} })}>
            Reset All ({changed})
          </button>
        )}
        <button className="button primary" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </Modal>
  );
}
