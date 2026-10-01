import { hasActive, type Command } from "./core";

// The AI code loads on first use.
const ai = () => import("../ai");

/** The AI assistant's commands (AI menu). */
export const aiCommands: Record<string, Command> = {
  aiImprove: { id: "aiImprove", label: "AI: Improve Writing", run: async () => (await ai()).runAiAction("improve"), enabled: hasActive },
  aiFixGrammar: { id: "aiFixGrammar", label: "AI: Fix Spelling and Grammar", run: async () => (await ai()).runAiAction("fixGrammar"), enabled: hasActive },
  aiShorter: { id: "aiShorter", label: "AI: Make Shorter", run: async () => (await ai()).runAiAction("shorter"), enabled: hasActive },
  aiSummarize: { id: "aiSummarize", label: "AI: Summarize", run: async () => (await ai()).runAiAction("summarize"), enabled: hasActive },
  aiContinue: { id: "aiContinue", label: "AI: Continue Writing", run: async () => (await ai()).runAiAction("continue"), enabled: hasActive },
  aiTranslate: { id: "aiTranslate", label: "AI: Translate…", run: async () => (await ai()).runAiAction("translate"), enabled: hasActive },
  aiWrite: { id: "aiWrite", label: "AI: Write…", shortcut: "Mod+Shift+J", run: async () => (await ai()).runAiAction("write"), enabled: hasActive },
  aiAsk: { id: "aiAsk", label: "AI: Ask Claude…", shortcut: "Mod+J", run: async () => (await ai()).runAiAction("ask"), enabled: hasActive },
};
