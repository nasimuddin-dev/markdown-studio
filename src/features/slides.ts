import { stripFrontMatter } from "../services/frontMatter";

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const SEPARATOR = /^ {0,3}---\s*$/;
const SLIDE_HEADING = /^ {0,3}#{1,2}\s/;

/**
 * Splits a document into slides for View → Present as Slides. Slides are
 * separated by `---` lines that follow a blank line (a `---` right under a
 * line of text is a heading underline). A document without separators gets a
 * slide per `#` or `##` heading. Code blocks and front matter are respected.
 */
export function splitSlides(text: string): string[] {
  const lines = stripFrontMatter(text).split(/\r?\n/);
  const inCode: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const f = FENCE.exec(line);
    if (f) {
      inCode.push(true);
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    inCode.push(fence !== null);
  }

  const split = (starts: (i: number) => "cut" | "break" | null) => {
    const slides: string[] = [];
    let current: string[] = [];
    const flush = () => {
      const body = current.join("\n").trim();
      if (body) slides.push(body);
      current = [];
    };
    lines.forEach((line, i) => {
      const kind = inCode[i] ? null : starts(i);
      if (kind === "cut") flush(); // the separator line itself is dropped
      else if (kind === "break") {
        flush();
        current.push(line);
      } else current.push(line);
    });
    flush();
    return slides;
  };

  const bySeparator = split((i) => (SEPARATOR.test(lines[i]) && (i === 0 || !lines[i - 1].trim()) ? "cut" : null));
  if (bySeparator.length > 1) return bySeparator;
  const byHeading = split((i) => (SLIDE_HEADING.test(lines[i]) ? "break" : null));
  return byHeading.length ? byHeading : [""];
}
