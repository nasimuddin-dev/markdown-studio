import { useMemo } from "react";
import { scopeCustomCss } from "../services/customCss";
import { useSettings } from "../stores/settingsStore";

/** The user's custom CSS, limited to rendered documents (preview, print, slides). */
export function CustomDocumentCss() {
  const css = useSettings((s) => s.settings.customCss);
  const scoped = useMemo(() => scopeCustomCss(css), [css]);
  return scoped ? <style data-custom-document-css="">{scoped}</style> : null;
}
