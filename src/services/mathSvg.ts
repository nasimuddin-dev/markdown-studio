/**
 * Display math as SVG for PDF export, drawn by MathJax from the LaTeX source.
 * MathJax computes the glyph outlines itself, so this works in every web
 * engine (unlike drawing MathML onto a canvas, which WebKit refuses) and the
 * result stays sharp at any zoom. Loaded only when a PDF with math is made.
 */
// Must come first: MathJax needs it while loading.
import "./mathjaxEnv";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const html = mathjax.document("", {
  // Without noerrors/noundefined, a mistake becomes an error node, which is detected below.
  InputJax: new TeX({ packages: AllPackages.filter((p) => !["bussproofs", "noerrors", "noundefined"].includes(p)) }),
  // Paths inline in each picture, so the SVG stands alone.
  OutputJax: new SVG({ fontCache: "none" }),
});

/** An `ex` in points at the PDF's 10.5 pt body text. */
const EX_PT = 4.7;

/**
 * The formula as an SVG document with its size in points, or null when
 * MathJax can't typeset it (an unknown command, for example).
 */
export function mathToSvg(tex: string): { svg: string; width: number; height: number } | null {
  try {
    const node = html.convert(tex, { display: true });
    const svg = adaptor.firstChild(node) as Parameters<typeof adaptor.outerHTML>[0];
    // A TeX error is drawn as a red error box; don't put that in a document.
    if (adaptor.outerHTML(svg).includes('data-mml-node="merror"')) return null;
    const ex = (name: string) => parseFloat(String(adaptor.getAttribute(svg, name)).replace("ex", ""));
    const width = ex("width") * EX_PT;
    const height = ex("height") * EX_PT;
    if (!(width > 0 && height > 0)) return null;
    adaptor.setAttribute(svg, "width", `${width}pt`);
    adaptor.setAttribute(svg, "height", `${height}pt`);
    // The PDF's text colour (PDF drawing doesn't know CSS's currentColor).
    return { svg: adaptor.outerHTML(svg).replace(/currentColor/g, "#1D2330"), width, height };
  } catch {
    return null;
  }
}
