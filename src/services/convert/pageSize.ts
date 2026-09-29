/** Paper sizes for PDF and Word export. */
export type PageSize = "a4" | "letter";

/** Page dimensions in points (1/72 in). */
export const PAGE_POINTS: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

/** Regions that use US Letter paper; everywhere else uses A4. */
const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "GT", "CR", "PA", "DO", "PR"]);

/**
 * The paper size for a setting: "auto" follows the region of the language
 * tag (en-US → Letter, en-GB or de-DE → A4). A tag without a region uses A4.
 */
export function resolvePageSize(setting: "auto" | PageSize, locale: string | undefined): PageSize {
  if (setting !== "auto") return setting;
  let region: string | undefined;
  try {
    region = locale ? new Intl.Locale(locale).region : undefined;
  } catch {
    region = undefined;
  }
  return region && LETTER_REGIONS.has(region) ? "letter" : "a4";
}
