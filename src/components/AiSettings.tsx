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

/** Settings → AI Assistant → a local model: the Ollama address and which installed model to use. */
function LocalModelSettings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [url, setUrl] = useState(settings.aiLocalUrl);
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (address: string) => {
    setError(null);
    try {
      const found = await backend().aiLocalModels(address);
      setModels(found);
      // The first installed model, until one is chosen.
      if (!useSettings.getState().settings.aiLocalModel && found[0]) update({ aiLocalModel: found[0] });
    } catch (e) {
      setModels(null);
      setError(describeError(e, "list the local models"));
    }
  };
  useEffect(() => {
    void load(settings.aiLocalUrl);
    // Only when the saved address changes.
  }, [settings.aiLocalUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?\/?$/.test(url.trim());
  return (
    <>
      <label htmlFor="setting-aiLocalUrl">Ollama address</label>
      <div className="inline-row">
        <input id="setting-aiLocalUrl" type="url" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="button" disabled={!valid} onClick={() => (url.trim() === settings.aiLocalUrl ? void load(url.trim()) : update({ aiLocalUrl: url.trim() }))}>
          {url.trim() === settings.aiLocalUrl ? "Refresh" : "Connect"}
        </button>
      </div>
      {!valid && <p className="muted small">Use an address on this computer, such as http://localhost:11434.</p>}
      {error && <p className="small" role="alert">{error}</p>}
      <label htmlFor="setting-aiLocalModel">Local model</label>
      <select id="setting-aiLocalModel" value={settings.aiLocalModel} onChange={(e) => update({ aiLocalModel: e.target.value })} disabled={!models?.length}>
        {!models?.length && <option value={settings.aiLocalModel}>{settings.aiLocalModel || "No models found"}</option>}
        {models?.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <p className="muted small">
        Install Ollama from ollama.com and download a model (for example <code>ollama pull llama3.2</code>). Your text goes to Ollama on this computer and
        nowhere else. Local models are usually slower and less accurate than Claude.
      </p>
    </>
  );
}

/** Settings → AI Assistant: turn it on, choose Claude or a local model, manage the API key, choose the model. */
export function AiSettings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const locked = useSettings((s) => s.locked);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings.aiEnabled || !backend().capabilities.ai) return;
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
        <input type="checkbox" checked={settings.aiEnabled} disabled={locked.includes("aiEnabled")} onChange={(e) => update({ aiEnabled: e.target.checked })} /> Turn on AI commands (Claude, by
        Anthropic)
      </label>
      <p className="muted small">
        Improve, fix, shorten, summarize, translate or continue text from the AI menu. With Claude, text is sent to Anthropic only when you run a command,
        using your own API key; with a local model it stays on this computer.
      </p>
      {settings.aiEnabled && !backend().capabilities.ai && (
        <p className="muted small">The AI assistant is available in the Markpion desktop app, which keeps your API key in the system's credential store.</p>
      )}
      {settings.aiEnabled && backend().capabilities.ai && (
        <fieldset className="settings-choice">
          <legend>Answers come from</legend>
          <label className="check">
            <input type="radio" name="aiProvider" checked={settings.aiProvider === "claude"} disabled={locked.includes("aiProvider")} onChange={() => update({ aiProvider: "claude" })} />{" "}
            Claude, by Anthropic (needs an API key; text is sent to Anthropic)
          </label>
          <label className="check">
            <input type="radio" name="aiProvider" checked={settings.aiProvider === "ollama"} disabled={locked.includes("aiProvider")} onChange={() => update({ aiProvider: "ollama" })} />{" "}
            A local model with Ollama (text stays on this computer)
          </label>
        </fieldset>
      )}
      {settings.aiEnabled && backend().capabilities.ai && settings.aiProvider === "ollama" && <LocalModelSettings />}
      {settings.aiEnabled && backend().capabilities.ai && settings.aiProvider === "claude" && (
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
          <select id="setting-aiModel" value={settings.aiModel} disabled={locked.includes("aiModel")} onChange={(e) => update({ aiModel: e.target.value })}>
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
