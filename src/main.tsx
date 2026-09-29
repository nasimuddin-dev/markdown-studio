import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { saveRecoveryNow, startApp } from "./features/lifecycle";
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
      <button className="button primary" onClick={() => void reload()}>Reload</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary area="window" fallback={(error) => <AppCrash error={error} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

void startApp();
