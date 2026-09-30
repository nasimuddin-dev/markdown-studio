import { create } from "zustand";

export interface DialogButton<T extends string = string> {
  id: T;
  label: string;
  variant?: "primary" | "danger" | "default";
}

export interface DialogRequest {
  id: number;
  title: string;
  message: string;
  detail?: string;
  buttons: DialogButton[];
  /** Button returned when the dialog is dismissed with Escape. */
  cancelId: string;
  /** When set, shows a text input and the promise resolves with its value. */
  input?: { value: string; placeholder?: string; selectUntil?: number };
  resolve: (result: { button: string; value?: string }) => void;
}

export interface Toast {
  id: number;
  kind: "info" | "success" | "error" | "warning";
  message: string;
}

interface UiState {
  dialogs: DialogRequest[];
  /** A blocking operation in progress (e.g. installing an update); fraction null = indeterminate. */
  progress: { title: string; message: string; fraction: number | null } | null;
  setProgress(p: UiState["progress"]): void;
  toasts: Toast[];
  settingsOpen: boolean;
  aboutOpen: boolean;
  paletteOpen: boolean;
  /** What the palette lists: commands and tabs, or document templates. */
  paletteMode: "commands" | "templates" | "files" | "headings" | "folderHeadings" | "compare";
  openTemplatePicker(): void;
  openFilePicker(): void;
  openHeadingPicker(): void;
  openFolderHeadingPicker(): void;
  openComparePicker(): void;
  shortcutsOpen: boolean;
  setShortcutsOpen(open: boolean): void;
  /** Distraction-free writing: hides chrome and centres the editor. */
  focusMode: boolean;
  setFocusMode(on: boolean): void;
  /** View → Present as Slides is showing the active document. */
  presenting: boolean;
  setPresenting(on: boolean): void;
  sidebarView: "explorer" | "search" | "links";
  problems: { errors: number; warnings: number; infos: number } | null;
  /** Document whose File History dialog is open. */
  historyDocId: string | null;
  setHistoryDocId(id: string | null): void;
  /** Compare dialog: the active document and the other file. */
  compare: { docId: string; path: string } | null;
  setCompare(compare: { docId: string; path: string } | null): void;
  setProblems(p: UiState["problems"]): void;
  /** Incremented to move focus into the search box. */
  searchFocusToken: number;
  /** Incremented to (re)run the workspace link check. */
  linkCheckToken: number;
  checkLinks(): void;
  cursor: { line: number; col: number; selected: number };
  setCursor(c: UiState["cursor"]): void;
  setSettingsOpen(open: boolean): void;
  setAboutOpen(open: boolean): void;
  setPaletteOpen(open: boolean): void;
  setSidebarView(view: UiState["sidebarView"]): void;
  focusSearch(): void;
  closeDialog(id: number, result: { button: string; value?: string }): void;
  notify(kind: Toast["kind"], message: string): void;
  dismissToast(id: number): void;
}

let nextId = 1;

export const useUi = create<UiState>((set, get) => ({
  dialogs: [],
  progress: null,
  setProgress: (progress) => set({ progress }),
  toasts: [],
  settingsOpen: false,
  aboutOpen: false,
  paletteOpen: false,
  paletteMode: "commands",
  openTemplatePicker: () => set({ paletteOpen: true, paletteMode: "templates" }),
  openFilePicker: () => set({ paletteOpen: true, paletteMode: "files" }),
  openHeadingPicker: () => set({ paletteOpen: true, paletteMode: "headings" }),
  openFolderHeadingPicker: () => set({ paletteOpen: true, paletteMode: "folderHeadings" }),
  openComparePicker: () => set({ paletteOpen: true, paletteMode: "compare" }),
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),
  presenting: false,
  setPresenting: (presenting) => set({ presenting }),
  sidebarView: "explorer",
  problems: null,
  historyDocId: null,
  setHistoryDocId: (historyDocId) => set({ historyDocId }),
  compare: null,
  setCompare: (compare) => set({ compare }),
  setProblems: (problems) => set({ problems }),
  searchFocusToken: 0,
  linkCheckToken: 0,
  cursor: { line: 1, col: 1, selected: 0 },
  setCursor: (cursor) => set({ cursor }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen, paletteMode: "commands" }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  checkLinks: () => set((s) => ({ sidebarView: "links", linkCheckToken: s.linkCheckToken + 1 })),
  focusSearch: () => set((s) => ({ sidebarView: "search", searchFocusToken: s.searchFocusToken + 1 })),
  closeDialog(id, result) {
    const d = get().dialogs.find((x) => x.id === id);
    set({ dialogs: get().dialogs.filter((x) => x.id !== id) });
    d?.resolve(result);
  },
  notify(kind, message) {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismissToast(id), kind === "error" ? 9000 : 4000);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Shows a modal dialog and resolves with the id of the chosen button. */
export function ask<T extends string>(opts: {
  title: string;
  message: string;
  detail?: string;
  buttons: DialogButton<T>[];
  cancelId: T;
}): Promise<T> {
  return new Promise((resolve) => {
    const req: DialogRequest = {
      id: nextId++,
      ...opts,
      resolve: (r) => resolve(r.button as T),
    };
    useUi.setState((s) => ({ dialogs: [...s.dialogs, req] }));
  });
}

/** Shows a modal with a text field. Resolves with the value, or `null` if cancelled. */
export function promptText(opts: {
  title: string;
  message: string;
  value: string;
  okLabel?: string;
  selectUntil?: number;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const req: DialogRequest = {
      id: nextId++,
      title: opts.title,
      message: opts.message,
      buttons: [
        { id: "cancel", label: "Cancel" },
        { id: "ok", label: opts.okLabel ?? "OK", variant: "primary" },
      ],
      cancelId: "cancel",
      input: { value: opts.value, selectUntil: opts.selectUntil },
      resolve: (r) => resolve(r.button === "ok" ? (r.value ?? "").trim() || null : null),
    };
    useUi.setState((s) => ({ dialogs: [...s.dialogs, req] }));
  });
}

export const notify = (kind: Toast["kind"], message: string) => useUi.getState().notify(kind, message);
