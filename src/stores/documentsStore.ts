import { create } from "zustand";
import type { Doc } from "../types";

export const isDirty = (d: Doc) => d.content !== d.savedContent;

interface DocumentsState {
  docs: Doc[];
  activeId: string | null;
  add(doc: Doc, activate?: boolean): void;
  update(id: string, patch: Partial<Doc>): void;
  setContent(id: string, content: string): void;
  remove(id: string): void;
  setActive(id: string | null): void;
  /** Moves the active tab forward (+1) or backward (-1), wrapping around (FR-043). */
  cycle(delta: number): void;
  move(id: string, toIndex: number): void;
}

let counter = 0;
export const newDocId = () => `doc-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useDocuments = create<DocumentsState>((set, get) => ({
  docs: [],
  activeId: null,
  add(doc, activate = true) {
    set((s) => ({ docs: [...s.docs, doc], activeId: activate ? doc.id : s.activeId ?? doc.id }));
  },
  update(id, patch) {
    set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  },
  setContent(id, content) {
    const doc = get().docs.find((d) => d.id === id);
    // A read-only document isn't changed by edits (reloading from disk uses `update`).
    if (doc && doc.content !== content && !doc.readOnly) get().update(id, { content });
  },
  remove(id) {
    set((s) => {
      const idx = s.docs.findIndex((d) => d.id === id);
      if (idx < 0) return s;
      const docs = s.docs.filter((d) => d.id !== id);
      let activeId = s.activeId;
      if (activeId === id) activeId = docs[Math.min(idx, docs.length - 1)]?.id ?? null;
      return { docs, activeId };
    });
  },
  setActive(id) {
    set({ activeId: id });
  },
  cycle(delta) {
    const { docs, activeId } = get();
    if (docs.length < 2) return;
    const idx = docs.findIndex((d) => d.id === activeId);
    const next = (idx + delta + docs.length) % docs.length;
    set({ activeId: docs[next].id });
  },
  move(id, toIndex) {
    set((s) => {
      const docs = [...s.docs];
      const from = docs.findIndex((d) => d.id === id);
      if (from < 0) return s;
      const [doc] = docs.splice(from, 1);
      docs.splice(Math.max(0, Math.min(toIndex, docs.length)), 0, doc);
      return { docs };
    });
  },
}));

export const activeDoc = () => {
  const { docs, activeId } = useDocuments.getState();
  return docs.find((d) => d.id === activeId) ?? null;
};
