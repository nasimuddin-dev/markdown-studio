import { backend } from "../../services";
import { activeDoc } from "../../stores/documentsStore";
import { useSettings } from "../../stores/settingsStore";
import { useUi } from "../../stores/uiStore";
import { useWorkspace } from "../../stores/workspaceStore";
import type { ViewMode } from "../../types";
import { setReadOnly } from "../documents";
import { hasActive, type Command } from "./core";

const VIEW_ORDER: ViewMode[] = ["split", "editor", "preview"];

const toggleFullScreen = () => backend().toggleFullScreen();

function bumpFont(delta: number) {
  const { settings, update } = useSettings.getState();
  update({ fontSize: settings.fontSize + delta });
}

/** View modes, panels, editor options, zoom, the palette and settings. */
export const viewCommands: Record<string, Command> = {
  toggleView: {
    id: "toggleView",
    label: "Cycle View Mode",
    shortcut: "Mod+\\",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ viewMode: VIEW_ORDER[(VIEW_ORDER.indexOf(settings.viewMode) + 1) % VIEW_ORDER.length] });
    },
  },
  viewEditor: { id: "viewEditor", label: "Editor Only", shortcut: "Mod+1", run: () => useSettings.getState().update({ viewMode: "editor" }), checked: () => useSettings.getState().settings.viewMode === "editor" },
  viewSplit: { id: "viewSplit", label: "Split View", shortcut: "Mod+2", run: () => useSettings.getState().update({ viewMode: "split" }), checked: () => useSettings.getState().settings.viewMode === "split" },
  viewPreview: { id: "viewPreview", label: "Preview Only", shortcut: "Mod+3", run: () => useSettings.getState().update({ viewMode: "preview" }), checked: () => useSettings.getState().settings.viewMode === "preview" },
  toggleExplorer: {
    id: "toggleExplorer",
    label: "Toggle File Explorer",
    shortcut: "Mod+Shift+E",
    checked: () => useSettings.getState().settings.showExplorer,
    run: () => {
      const { settings, update } = useSettings.getState();
      const ui = useUi.getState();
      if (settings.showExplorer && ui.sidebarView !== "explorer") ui.setSidebarView("explorer");
      else {
        ui.setSidebarView("explorer");
        update({ showExplorer: !settings.showExplorer });
      }
    },
  },
  checkLinks: {
    id: "checkLinks",
    label: "Check Links in Folder",
    run: () => {
      useSettings.getState().update({ showExplorer: true });
      useUi.getState().checkLinks();
    },
    enabled: () => !!useWorkspace.getState().root,
  },
  findInFiles: {
    id: "findInFiles",
    label: "Find in Files",
    shortcut: "Mod+Shift+F",
    run: () => {
      useSettings.getState().update({ showExplorer: true });
      useUi.getState().focusSearch();
    },
  },
  toggleOutline: {
    id: "toggleOutline",
    label: "Toggle Outline",
    shortcut: "Mod+Shift+L",
    checked: () => useSettings.getState().settings.showOutline && useSettings.getState().settings.showExplorer,
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ showOutline: !settings.showOutline, showExplorer: true });
    },
  },
  toggleTheme: {
    id: "toggleTheme",
    label: "Toggle Dark Theme",
    checked: () => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
    run: () => {
      const { update } = useSettings.getState();
      const dark = document.documentElement.dataset.theme === "dark";
      update({ theme: dark ? "light" : "dark" });
    },
  },
  zoomIn: { id: "zoomIn", label: "Increase Font Size", shortcut: "Mod+=", run: () => bumpFont(1) },
  zoomOut: { id: "zoomOut", label: "Decrease Font Size", shortcut: "Mod+-", run: () => bumpFont(-1) },
  zoomReset: { id: "zoomReset", label: "Reset Font Size", shortcut: "Mod+0", run: () => useSettings.getState().update({ fontSize: 15 }) },
  commandPalette: {
    id: "commandPalette",
    label: "Command Palette…",
    shortcut: "Mod+Shift+P",
    run: () => useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen),
  },
  settings: { id: "settings", label: "Settings…", shortcut: "Mod+,", run: () => useUi.getState().setSettingsOpen(true) },
  toggleWordWrap: {
    id: "toggleWordWrap",
    label: "Toggle Word Wrap",
    checked: () => useSettings.getState().settings.lineWrapping,
    shortcut: "Alt+Z",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ lineWrapping: !settings.lineWrapping });
    },
  },
  toggleTypewriter: {
    id: "toggleTypewriter",
    label: "Toggle Typewriter Scrolling",
    checked: () => useSettings.getState().settings.typewriterScrolling,
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ typewriterScrolling: !settings.typewriterScrolling });
    },
  },
  toggleDimParagraphs: {
    id: "toggleDimParagraphs",
    label: "Toggle Dim Other Paragraphs",
    checked: () => useSettings.getState().settings.dimOtherParagraphs,
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ dimOtherParagraphs: !settings.dimOtherParagraphs });
    },
  },
  toggleLineNumbers: {
    id: "toggleLineNumbers",
    label: "Toggle Line Numbers",
    checked: () => useSettings.getState().settings.lineNumbers,
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ lineNumbers: !settings.lineNumbers });
    },
  },
  toggleToolbar: {
    id: "toggleToolbar",
    label: "Toggle Formatting Toolbar",
    checked: () => useSettings.getState().settings.showToolbar,
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ showToolbar: !settings.showToolbar });
    },
  },
  toggleReadOnly: {
    id: "toggleReadOnly",
    label: "Toggle Read-Only",
    checked: () => !!activeDoc()?.readOnly,
    run: () => {
      const doc = activeDoc();
      if (doc) setReadOnly(doc.id, !doc.readOnly);
    },
    enabled: hasActive,
  },
  presentSlides: {
    id: "presentSlides",
    label: "Present as Slides",
    run: () => useUi.getState().setPresenting(true),
    enabled: hasActive,
  },
  focusMode: {
    id: "focusMode",
    label: "Toggle Focus Mode",
    checked: () => useUi.getState().focusMode,
    shortcut: "Mod+Shift+Enter",
    run: () => {
      const ui = useUi.getState();
      ui.setFocusMode(!ui.focusMode);
    },
  },
  fullScreen: { id: "fullScreen", label: "Toggle Full Screen", shortcut: "F11", run: () => toggleFullScreen() },
  shortcuts: { id: "shortcuts", label: "Keyboard Shortcuts", run: () => useUi.getState().setShortcutsOpen(true) },
};
