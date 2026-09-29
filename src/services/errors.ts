import type { ErrorKind } from "../types";

/** Error raised by the native backend, carrying a category for UI handling. */
export class AppError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const KINDS: ErrorKind[] = [
  "notFound", "permissionDenied", "outOfScope", "invalidPath", "encoding",
  "conflict", "alreadyExists", "diskFull", "tooLarge", "io", "ai",
];

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e && typeof e === "object" && "kind" in e && KINDS.includes((e as { kind: ErrorKind }).kind)) {
    const { kind, message } = e as { kind: ErrorKind; message?: string };
    return new AppError(kind, message ?? kind);
  }
  if (e instanceof Error) return new AppError("io", e.message);
  return new AppError("io", String(e));
}

/**
 * Explains what happened and what the user can do next (SRS §12, §15).
 * `action` describes the operation, e.g. "save “notes.md”".
 */
export function describeError(e: unknown, action: string): string {
  const err = toAppError(e);
  switch (err.kind) {
    case "notFound":
      return `Couldn't ${action}: the file or folder no longer exists. It may have been moved or deleted.`;
    case "permissionDenied":
      return `Couldn't ${action}: you don't have permission to write here. Use Save As to save a copy somewhere else.`;
    case "outOfScope":
      return `Couldn't ${action}: Markpion hasn't been given access to this location. Open the file or its folder first.`;
    case "invalidPath":
      return `Couldn't ${action}: ${err.message}`;
    case "encoding":
      return `Couldn't ${action}: ${err.message}`;
    case "conflict":
      return `Couldn't ${action}: the file was changed by another program.`;
    case "alreadyExists":
      return `Couldn't ${action}: a file or folder with that name already exists.`;
    case "diskFull":
      return `Couldn't ${action}: the disk is full. Free up space and try again — your text is still in the editor.`;
    case "tooLarge":
      return `Couldn't ${action}: ${err.message}`;
    case "ai":
      return err.message;
    default:
      return `Couldn't ${action}: ${err.message}`;
  }
}
