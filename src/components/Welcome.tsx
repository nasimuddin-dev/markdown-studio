import { useEffect, useState } from "react";
import { backend } from "../services";
import { basename, displayPath } from "../services/paths";
import type { RecentEntry } from "../types";
import { commands, formatShortcut } from "../features/commands";
import { newDocument, openFileDialog, openRecentFile } from "../features/documents";
import { openFolderDialog, openRecentFolder } from "../features/workspace";
import { Icon } from "./Icon";

/** Shown when no document is open (Appendix A.1, step 4). */
export function Welcome() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  useEffect(() => {
    backend().listRecent().then(setRecent).catch(() => {});
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1>Markpion</h1>
        <p className="muted">Write, preview and organize Markdown — locally and privately.</p>
        <div className="welcome-actions">
          <button className="button primary" onClick={() => newDocument()}>
            <Icon name="filePlus" /> New File <kbd>{formatShortcut(commands.newFile.shortcut)}</kbd>
          </button>
          <button className="button" onClick={() => void openFileDialog()}>
            <Icon name="file" /> Open File <kbd>{formatShortcut(commands.openFile.shortcut)}</kbd>
          </button>
          <button className="button" onClick={() => void openFolderDialog()}>
            <Icon name="folderOpen" /> Open Folder <kbd>{formatShortcut(commands.openFolder.shortcut)}</kbd>
          </button>
        </div>
        {recent.length > 0 && (
          <div className="welcome-recent">
            <h2>Recent</h2>
            <ul>
              {recent.slice(0, 8).map((r) => (
                <li key={r.path}>
                  <button
                    className="link-button"
                    title={r.path}
                    onClick={() => void (r.kind === "file" ? openRecentFile(r.path) : openRecentFolder(r.path))}
                  >
                    <Icon name={r.kind === "file" ? "file" : "folder"} size={14} />
                    <span>{basename(r.path)}</span>
                    <span className="muted small">{displayPath(r.path, 48)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
