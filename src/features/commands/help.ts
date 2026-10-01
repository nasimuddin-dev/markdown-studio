import { backend } from "../../services";
import { notify, useUi } from "../../stores/uiStore";
import type { Command } from "./core";

/** Updates, About and diagnostic logs (Help menu). */
export const helpCommands: Record<string, Command> = {
  checkUpdates: {
    id: "checkUpdates",
    label: "Check for Updates…",
    run: async () => void (await (await import("../updates")).checkForUpdates({ manual: true })),
  },
  about: { id: "about", label: "About Markpion", run: () => useUi.getState().setAboutOpen(true) },
  exportLogs: {
    id: "exportLogs",
    label: "Export Diagnostic Logs…",
    run: async () => {
      try {
        const path = await backend().exportLogs();
        if (path) notify("success", "Diagnostic logs exported.");
      } catch (e) {
        notify("error", `Couldn't export logs: ${(e as Error).message}`);
      }
    },
  },
};
