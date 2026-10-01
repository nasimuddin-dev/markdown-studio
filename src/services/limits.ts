/**
 * Size limits shared by the UI, so every feature draws the line in the same
 * place. Above LARGE_DOCUMENT_CHARS a document is "large": the live preview
 * pauses, the Git change markers, the Markdown checks and the live word count
 * stop running on every keystroke, and the status bar counts settle after a
 * pause instead. The editor itself keeps working.
 */
export const LARGE_DOCUMENT_CHARS = 1_000_000;

/** Pictures the preview keeps decoded in memory (data URLs) before the oldest are dropped. */
export const IMAGE_CACHE_BYTES = 96 * 1024 * 1024;
