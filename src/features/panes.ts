/**
 * F6 / Shift+F6 move keyboard focus between the visible panes: the sidebar,
 * the editor and the preview (as in browsers and other editors).
 */
const PANES: Array<{ area: string; targets: string[] }> = [
  // The selected Explorer row, else the first Outline heading, else the selected sidebar tab.
  { area: ".sidebar", targets: [".tree-row[tabindex='0']", ".sidebar-pane [tabindex='0']", ".outline-item", ".sidebar [role='tab'][aria-selected='true']"] },
  { area: ".cm-editor", targets: [".cm-content"] },
  // Not the placeholder shown while the preview loads, which can't take focus.
  { area: ".preview", targets: [".preview[tabindex]"] },
];

const shown = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && el.getClientRects().length > 0;

export function focusPane(step: 1 | -1): boolean {
  const panes = PANES.map((p) => ({ area: p.area, el: p.targets.map((t) => document.querySelector(t)).find(shown) ?? null })).filter((p) => p.el);
  if (!panes.length) return false;
  const active = document.activeElement;
  const current = panes.findIndex((p) => !!active?.closest(p.area));
  const next = panes[(current + step + panes.length) % panes.length] ?? panes[0];
  next.el!.focus();
  return true;
}
