import { create } from "zustand";

/** Where an AI answer goes: over the original text, after it, or at the cursor. */
export type AiPlacement = "replace" | "below" | "cursor";

export interface AiReview {
  docId: string;
  label: string;
  /** The text that was sent (empty for Continue Writing). */
  original: string;
  suggestion: string;
  from: number;
  to: number;
  placement: AiPlacement;
}

interface AiState {
  /** The request being waited for; `seq` tells a cancelled or older request apart. */
  busy: { label: string; seq: number } | null;
  /** An answer waiting for the user to apply, copy or discard it. */
  review: AiReview | null;
  setBusy(busy: AiState["busy"]): void;
  setReview(review: AiReview | null): void;
}

/** State of the AI assistant's UI, kept apart from the general UI store. */
export const useAi = create<AiState>((set) => ({
  busy: null,
  review: null,
  setBusy: (busy) => set({ busy }),
  setReview: (review) => set({ review }),
}));
