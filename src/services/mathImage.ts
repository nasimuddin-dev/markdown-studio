/**
 * Draws a LaTeX formula as a PNG, for exports that need a picture (Word, for
 * formulas it can't take as an equation; PDF when the vector drawing fails):
 * MathJax draws it as a plain SVG (outlines, no fonts or foreignObject), and
 * a canvas turns that into pixels. Plain SVG pictures don't taint canvases,
 * so this also works in WebKit (macOS).
 */
const SCALE = 3; // pixels per CSS pixel, so formulas print sharply

export async function mathToPng(latex: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { mathToSvg } = await import("./mathSvg");
  const drawn = mathToSvg(latex);
  if (!drawn) throw new Error("The formula couldn't be typeset");
  // Points to CSS pixels, with a little room around the formula.
  const width = Math.ceil((drawn.width * 4) / 3) + 8;
  const height = Math.ceil((drawn.height * 4) / 3) + 4;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawn.svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 4 * SCALE, 2 * SCALE, (width - 8) * SCALE, (height - 4) * SCALE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The formula couldn't be converted to an image");
  return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
}
