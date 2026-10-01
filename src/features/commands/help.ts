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
  thirdPartyNotices: {
    id: "thirdPartyNotices",
    label: "Third-Party Notices",
    run: async () => {
      try {
        const [{ version }, { noticesPage }] = await Promise.all([backend().appInfo(), import("../../services/updates")]);
        await backend().openExternal(noticesPage(version));
      } catch (e) {
        notify("error", `Couldn't open the notices: ${(e as Error).message}`);
      }
    },
  },
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
