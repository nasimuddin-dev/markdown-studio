import { AiSettings } from "./AiSettings";
import { SettingsLayout } from "./SettingsLayout";
import { useEffect, useState } from "react";
import { useUi } from "../stores/uiStore";
import { DEFAULT_SETTINGS, useSettings } from "../stores/settingsStore";
import { Modal } from "./Dialogs";
import { backend } from "../services";
import type { AppInfo, Settings } from "../types";

/** Settings screen (FR-025, FR-060, FR-061). Changes apply and persist immediately. */
export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  if (!open) return null;

  const locked = useSettings.getState().locked;
  const isLocked = (key: keyof Settings) => locked.includes(key);
  const field = <K extends keyof Settings>(key: K) => ({
    id: `setting-${key}`,
    value: settings[key] as unknown as string,
    disabled: isLocked(key),
  });

  return (
    <Modal title="Settings" onClose={() => setOpen(false)} className="settings-modal">
      {locked.length > 0 && (
        <p className="settings-managed" role="note">
          Some settings are managed by your organization and can't be changed here.
        </p>
      )}
      <SettingsLayout>
        <section>
          <h3>Appearance</h3>
          <label htmlFor="setting-theme">Theme</label>
          <select data-autofocus {...field("theme")} onChange={(e) => update({ theme: e.target.value as Settings["theme"] })}>
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          <label htmlFor="setting-fontSize">Editor font size</label>
          <div className="inline-field">
            <input
              type="range" min={10} max={28} {...field("fontSize")}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
            <output htmlFor="setting-fontSize">{settings.fontSize}px</output>
          </div>

          <label htmlFor="setting-fontFamily">Editor font family</label>
          <input
            className="text-input" type="text" placeholder="Default monospace" {...field("fontFamily")}
            onChange={(e) => update({ fontFamily: e.target.value })}
          />
        </section>

        <section>
          <h3>Editor</h3>
          <label className="check"><input type="checkbox" checked={settings.lineNumbers} disabled={isLocked("lineNumbers")} onChange={(e) => update({ lineNumbers: e.target.checked })} /> Show line numbers</label>
          <label className="check"><input type="checkbox" checked={settings.lineWrapping} disabled={isLocked("lineWrapping")} onChange={(e) => update({ lineWrapping: e.target.checked })} /> Wrap long lines</label>
          <label className="check"><input type="checkbox" checked={settings.pasteRichTextAsMarkdown} disabled={isLocked("pasteRichTextAsMarkdown")} onChange={(e) => update({ pasteRichTextAsMarkdown: e.target.checked })} /> Convert pasted web/Word content to Markdown (Ctrl+Shift+V pastes plain text)</label>
          <label className="check"><input type="checkbox" checked={settings.spellCheck} disabled={isLocked("spellCheck")} onChange={(e) => update({ spellCheck: e.target.checked })} /> Check spelling (uses the system dictionary)</label>
          <label className="check"><input type="checkbox" checked={settings.lintMarkdown} disabled={isLocked("lintMarkdown")} onChange={(e) => update({ lintMarkdown: e.target.checked })} /> Check Markdown for problems (broken links, headings, alt text)</label>
          <label htmlFor="setting-tabSize">Tab size</label>
          <select {...field("tabSize")} onChange={(e) => update({ tabSize: Number(e.target.value) })}>
            {[2, 4, 8].map((n) => <option key={n} value={n}>{n} spaces</option>)}
          </select>
        </section>

        <section>
          <h3>Files</h3>
          <label htmlFor="setting-autoSave">Auto save</label>
          <select {...field("autoSave")} onChange={(e) => update({ autoSave: e.target.value as Settings["autoSave"] })}>
            <option value="off">Off</option>
            <option value="afterDelay">After a delay</option>
            <option value="onFocusChange">When switching tabs or windows</option>
          </select>
          {settings.autoSave === "afterDelay" && (
            <>
              <label htmlFor="setting-autoSaveDelayMs">Auto save delay</label>
              <select {...field("autoSaveDelayMs")} onChange={(e) => update({ autoSaveDelayMs: Number(e.target.value) })}>
                <option value={500}>0.5 seconds</option>
                <option value={1000}>1 second</option>
                <option value={3000}>3 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </>
          )}
          <p className="muted small">Untitled documents are never auto-saved. Recovery snapshots are kept either way.</p>
          <label className="check"><input type="checkbox" checked={settings.trimTrailingWhitespace} disabled={isLocked("trimTrailingWhitespace")} onChange={(e) => update({ trimTrailingWhitespace: e.target.checked })} /> Trim trailing whitespace on save (keeps Markdown line breaks)</label>
          <label className="check"><input type="checkbox" checked={settings.updateTocOnSave} disabled={isLocked("updateTocOnSave")} onChange={(e) => update({ updateTocOnSave: e.target.checked })} /> Keep the table of contents up to date on save</label>
          <label className="check"><input type="checkbox" checked={settings.showGitStatus} disabled={isLocked("showGitStatus")} onChange={(e) => update({ showGitStatus: e.target.checked })} /> Show Git branch, changed files and changed lines (runs Git, read-only)</label>
          <label className="check"><input type="checkbox" checked={settings.insertFinalNewline} disabled={isLocked("insertFinalNewline")} onChange={(e) => update({ insertFinalNewline: e.target.checked })} /> Insert a final newline on save</label>
          <label htmlFor="setting-newFileLineEnding">Line endings for new files</label>
          <select {...field("newFileLineEnding")} onChange={(e) => update({ newFileLineEnding: e.target.value as Settings["newFileLineEnding"] })}>
            <option value="lf">LF (Unix, macOS)</option>
            <option value="crlf">CRLF (Windows)</option>
            <option value="auto">Match operating system</option>
          </select>
          <p className="muted small">Existing files always keep their own line endings.</p>
        </section>

        <section>
          <h3>Preview</h3>
          <label htmlFor="setting-previewDebounceMs">Update delay after typing</label>
          <select {...field("previewDebounceMs")} onChange={(e) => update({ previewDebounceMs: Number(e.target.value) })}>
            <option value={0}>Instant</option>
            <option value={150}>150 ms (default)</option>
            <option value={300}>300 ms</option>
            <option value={600}>600 ms</option>
            <option value={1000}>1 second</option>
          </select>
          <label className="check"><input type="checkbox" checked={settings.renderMath} disabled={isLocked("renderMath")} onChange={(e) => update({ renderMath: e.target.checked })} /> Render LaTeX math ($…$ and $$…$$)</label>
          <label className="check"><input type="checkbox" checked={settings.renderDiagrams} disabled={isLocked("renderDiagrams")} onChange={(e) => update({ renderDiagrams: e.target.checked })} /> Render Mermaid diagrams</label>
          <label className="check"><input type="checkbox" checked={settings.syncScroll} disabled={isLocked("syncScroll")} onChange={(e) => update({ syncScroll: e.target.checked })} /> Sync editor and preview scrolling</label>
          <label htmlFor="setting-customCss">Custom CSS for documents</label>
          <textarea
            className="text-input code-input" rows={5} spellCheck={false} placeholder="h1 { color: #0b4f8a; }"
            aria-describedby="setting-customCss-hint" {...field("customCss")}
            onChange={(e) => update({ customCss: e.target.value })}
          />
          <p className="muted small" id="setting-customCss-hint">
            Styles the preview, printing, slides and HTML export (not PDF or Word export). Rules apply only inside the document; <code>body</code> means the whole document.
          </p>
        </section>

        <section>
          <h3>Export</h3>
          <label htmlFor="setting-exportPageSize">Page size for PDF and Word</label>
          <select {...field("exportPageSize")} onChange={(e) => update({ exportPageSize: e.target.value as Settings["exportPageSize"] })}>
            <option value="auto">Automatic (from your region: Letter or A4)</option>
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="letter">Letter (8.5 × 11 in)</option>
          </select>
        </section>

        <AiSettings />

        <section>
          <h3>Startup</h3>
          <label className="check"><input type="checkbox" checked={settings.restoreSession} disabled={isLocked("restoreSession")} onChange={(e) => update({ restoreSession: e.target.checked })} /> Reopen last folder and files</label>
          <label className="check"><input type="checkbox" checked={settings.checkForUpdates} disabled={isLocked("checkForUpdates")} onChange={(e) => update({ checkForUpdates: e.target.checked })} /> Check for updates when Markpion starts (asks GitHub for the latest version; nothing else is sent)</label>
        </section>
      </SettingsLayout>
      <div className="modal-buttons">
        <button
          className="button"
          onClick={() => update({ ...DEFAULT_SETTINGS, ...useSettings.getState().managedDefaults, session: settings.session })}
        >
          Reset to Defaults
        </button>
        <button className="button" onClick={() => void import("../features/settingsTransfer").then((m) => m.exportSettings())}>
          Export…
        </button>
        <button className="button" onClick={() => void import("../features/settingsTransfer").then((m) => m.importSettings())}>
          Import…
        </button>
        <button className="button primary" onClick={() => setOpen(false)}>Done</button>
      </div>
    </Modal>
  );
}

export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen);
  const setOpen = useUi((s) => s.setAboutOpen);
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    if (open) backend().appInfo().then(setInfo).catch(() => {});
  }, [open]);
  if (!open) return null;
  return (
    <Modal title="About Markpion" onClose={() => setOpen(false)}>
      <div className="about">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <div>
          <p><strong>Markpion</strong> {info ? `version ${info.version}` : ""}</p>
          <p className="muted">A fast, local-first Markdown editor. Your documents stay on your computer.</p>
          {info && <p className="muted">Platform: {info.os} ({info.arch})</p>}
          {info && <p className="muted">Logs: {info.logPath}</p>}
        </div>
      </div>
      <div className="modal-buttons">
        <button className="button primary" onClick={() => setOpen(false)}>Close</button>
      </div>
    </Modal>
  );
}
