import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { saveRecoveryNow, startApp } from "./features/lifecycle";
import { installErrorCapture, reportCrash } from "./features/errorReports";
import { loadBackend } from "./services";
import "./styles/app.css";
import "./styles/markdown.css";

/** Last resort when the window itself fails to render: keep unsaved work and offer a restart. */
function AppCrash({ error }: { error: Error }) {
  const reload = async () => {
    await saveRecoveryNow().catch(() => {});
    window.location.reload();
  };
  return (
    <div className="app-crash" role="alert">
      <h1>Markpion hit an unexpected error</h1>
      <p>Your unsaved changes are kept. Reload the window, and Markpion offers to restore them.</p>
      <p><code>{error.message || String(error)}</code></p>
      <p className="app-crash-buttons">
        <button className="button primary" onClick={() => void reload()}>Reload</button>
        <button className="button" onClick={() => void reportCrash(error).catch(() => {})}>Report Problem…</button>
      </p>
    </div>
  );
}

// The desktop app has its backend already; the browser demo loads its in-memory one first.
installErrorCapture();
void loadBackend().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary area="window" fallback={(error) => <AppCrash error={error} />}>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  void startApp();
});
