import { useEffect, useState } from "react";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { useSettings } from "../stores/settingsStore";
import { notify } from "../stores/uiStore";
import type { AiStatus } from "../types";

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5 (most capable, default)",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (faster, lower cost)",
  "claude-haiku-4-5": "Claude Haiku 4.5 (fastest, lowest cost)",
};

/** Settings → AI Assistant: turn it on, manage the API key, choose the model. */
export function AiSettings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings.aiEnabled) return;
    backend().aiStatus().then(setStatus, () => setStatus(null));
  }, [settings.aiEnabled]);

  const saveKey = async (value: string | null) => {
    setBusy(true);
    try {
      setStatus(await backend().aiSetKey(value));
      setKey("");
      notify("success", value ? "API key checked and saved." : "API key removed.");
    } catch (e) {
      notify("error", describeError(e, value ? "save the API key" : "remove the API key"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3>AI Assistant</h3>
      <label className="check">
        <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => update({ aiEnabled: e.target.checked })} /> Turn on AI commands (Claude, by
        Anthropic)
      </label>
      <p className="muted small">
        Improve, fix, shorten, summarize, translate or continue text from the AI menu. Text is sent to Anthropic only when you run a command, using your own
        API key.
      </p>
      {settings.aiEnabled && (
        <>
          {status?.hasKey ? (
            <p className="small">
              API key saved in {status.keyStorage}.{" "}
              <button className="button small" disabled={busy} onClick={() => void saveKey(null)}>
                Remove Key
              </button>
            </p>
          ) : (
            <>
              <label htmlFor="setting-aiKey">Anthropic API key</label>
              <div className="inline-row">
                <input
                  id="setting-aiKey"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-ant-…"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button className="button" disabled={busy || !key.trim()} onClick={() => void saveKey(key)}>
                  {busy ? "Checking…" : "Save Key"}
                </button>
              </div>
              <p className="muted small">
                Create a key at console.anthropic.com. It's checked with Anthropic, then kept in {status?.keyStorage ?? "your system's credential store"},
                never in Markpion's settings file.
              </p>
            </>
          )}
          <label htmlFor="setting-aiModel">Model</label>
          <select id="setting-aiModel" value={settings.aiModel} onChange={(e) => update({ aiModel: e.target.value })}>
            {(status?.models ?? Object.keys(MODEL_NAMES)).map((m) => (
              <option key={m} value={m}>
                {MODEL_NAMES[m] ?? m}
              </option>
            ))}
          </select>
          {settings.aiConsent && (
            <label className="check">
              <input type="checkbox" checked onChange={() => update({ aiConsent: false })} /> Don't ask again before sending text (uncheck to be asked next
              time)
            </label>
          )}
        </>
      )}
    </section>
  );
}
