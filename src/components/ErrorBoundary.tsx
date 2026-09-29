import { Component, type ErrorInfo, type ReactNode } from "react";
import { backend } from "../services";

interface Props {
  /** What this area is called in the message, e.g. "preview". */
  area: string;
  /** When this value changes, a failed area tries to render again (e.g. the document changed). */
  resetKey?: unknown;
  /** Replaces the default message. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a rendering error to one area of the window. Without it, an
 * exception in any component unmounts the whole app and leaves an empty
 * window; with it, the rest keeps working (so documents can still be saved)
 * and the error is written to the diagnostic log.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = info.componentStack?.trim().split("\n")[0]?.trim() ?? "";
    try {
      backend().log("error", `ui.crash.${this.props.area}`, `${error.message}${where ? ` (${where})` : ""}`);
    } catch {
      /* logging must never throw from here */
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && !Object.is(prev.resetKey, this.props.resetKey)) this.setState({ error: null });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.retry);
    return (
      <div className="area-error" role="alert">
        <p>
          The {this.props.area} couldn't be shown because of an unexpected error. Your documents are not affected.
        </p>
        <code>{error.message || String(error)}</code>
        <button className="button" onClick={this.retry}>
          Try Again
        </button>
      </div>
    );
  }
}
