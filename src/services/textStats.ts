/** Lightweight text statistics (kept out of the Markdown pipeline bundle). */
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

export function countWords(text: string): number {
  const m = text.match(WORD);
  return m ? m.length : 0;
}

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  lines: number;
  paragraphs: number;
  /** Estimated minutes at 230 words per minute (at least 1 for non-empty text). */
  readingMinutes: number;
  /** Sentences: text ending in . ! ? or …, and headings, list items and paragraphs without one. */
  sentences: number;
  /** Estimated minutes read aloud, at 130 words per minute. */
  speakingMinutes: number;
  /** Flesch reading ease (0–100, higher is easier) for English text of 30 words or more; otherwise null. */
  readingEase: number | null;
}

/** Sentence ends, blank lines, and the starts of headings and list items. */
const SENTENCE_BREAK = /[.!?…]+(?=["'”’)\]]*(?:\s|$))|\n\s*\n|\n(?=\s*(?:[-*+]|\d+[.)]|#{1,6})\s)/u;

export function countSentences(text: string): number {
  return text.split(SENTENCE_BREAK).filter((s) => /\p{L}/u.test(s)).length;
}

/** English syllables, estimated from vowel groups (a silent final e doesn't count). */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Flesch reading ease, for English: 206.835 − 1.015 × words per sentence −
 * 84.6 × syllables per word, clamped to 0–100. Null for short texts and for
 * texts that aren't mostly written in the Latin alphabet.
 */
export function readingEase(text: string, sentences = countSentences(text)): number | null {
  const words = text.match(WORD) ?? [];
  if (words.length < 30 || !sentences) return null;
  const latin = words.filter((w) => /^[a-z'’-]+$/i.test(w));
  if (latin.length < words.length * 0.7) return null;
  const perWord = latin.reduce((n, w) => n + syllables(w), 0) / latin.length;
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * perWord;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/** A plain-words band for a reading ease score. */
export function readingEaseLabel(score: number): string {
  if (score >= 90) return "very easy";
  if (score >= 80) return "easy";
  if (score >= 70) return "fairly easy";
  if (score >= 60) return "plain English";
  if (score >= 50) return "fairly difficult";
  if (score >= 30) return "difficult";
  return "very difficult";
}

export function textStats(text: string): TextStats {
  const words = countWords(text);
  const chars = [...text];
  const sentences = countSentences(text);
  return {
    words,
    characters: chars.length,
    charactersNoSpaces: chars.filter((c) => !/\s/.test(c)).length,
    lines: text === "" ? 0 : text.split("\n").length,
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 230)),
    sentences,
    speakingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 130)),
    readingEase: readingEase(text, sentences),
  };
}
