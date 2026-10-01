import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUi, type DialogRequest } from "../stores/uiStore";
import { rememberFocus } from "../features/editorBridge";

/** Accessible modal: traps focus, closes on Escape, restores focus afterwards. */
export function Modal({ title, onClose, children, className, labelledBy }: {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restore = rememberFocus();
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("input, button.primary, button");
    first?.focus();
    return restore;
  }, []);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? "modal-title"}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const items = [...ref.current!.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex='0']")].filter(
              (x) => !x.hasAttribute("disabled"),
            );
            const idx = items.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey && idx <= 0) {
              e.preventDefault();
              items[items.length - 1]?.focus();
            } else if (!e.shiftKey && idx === items.length - 1) {
              e.preventDefault();
              items[0]?.focus();
            }
          }
        }}
      >
        <h2 id={labelledBy ?? "modal-title"} className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function RequestDialog({ req }: { req: DialogRequest }) {
  const close = useUi((s) => s.closeDialog);
  const [value, setValue] = useState(req.input?.value ?? "");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (req.input && input.current) {
      input.current.focus();
      input.current.setSelectionRange(0, req.input.selectUntil ?? req.input.value.length);
    }
  }, [req.input]);

  const primary = req.buttons.find((b) => b.variant === "primary");
  return (
    <Modal title={req.title} onClose={() => close(req.id, { button: req.cancelId })} labelledBy={`dlg-${req.id}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (primary) close(req.id, { button: primary.id, value });
        }}
      >
        <p className="modal-message">{req.message}</p>
        {req.detail && <p className="modal-detail">{req.detail}</p>}
        {req.input && (
          <input
            ref={input}
            className="text-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={req.message}
            spellCheck={false}
          />
        )}
        <div className="modal-buttons">
          {req.buttons.map((b) => (
            <button
              key={b.id}
              type={b.variant === "primary" ? "submit" : "button"}
              className={`button ${b.variant ?? ""}`}
              data-autofocus={!req.input && b.variant === "primary" ? true : undefined}
              onClick={b.variant === "primary" ? undefined : () => close(req.id, { button: b.id, value })}
            >
              {b.label}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}

/** Renders the top-most pending dialog request. */
export function DialogHost() {
  const dialogs = useUi((s) => s.dialogs);
  const progress = useUi((s) => s.progress);
  const top = dialogs[0];
  if (progress) return <ProgressDialog {...progress} />;
  return top ? <RequestDialog key={top.id} req={top} /> : null;
}

/** Non-dismissable progress for operations that must finish (e.g. installing an update). */
function ProgressDialog({ title, message, fraction }: { title: string; message: string; fraction: number | null }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="progress-title" aria-busy="true">
        <h2 id="progress-title" className="modal-title">{title}</h2>
        <p className="modal-message" role="status" aria-live="polite">{message}</p>
        {fraction === null ? (
          <progress className="modal-progress" aria-label={title} />
        ) : (
          <progress className="modal-progress" aria-label={title} max={1} value={fraction} />
        )}
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <span>{t.message}</span>
          {t.kind === "error" && (
            <button className="link-button toast-action" onClick={() => {
              dismiss(t.id);
              useUi.getState().openFeedback({ kind: "problem", error: { message: t.message } });
            }}>
              Report…
            </button>
          )}
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );
}
