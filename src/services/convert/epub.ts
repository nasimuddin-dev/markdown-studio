import JSZip from "jszip";
import type { ConversionResult, ExtractedImage } from "./docx";
import { linksToHeadingAnchors } from "./docx";
import { htmlToMarkdown } from "./html";

/**
 * EPUB e-book → Markdown: the chapters in reading order (the spine) as one
 * document, with front matter for the title, author and language. Pictures
 * are returned separately and linked as `assets/<name>`, like Word imports;
 * links between chapters become links within the document. Books protected
 * with DRM can't be read and are refused.
 */

const IMAGE_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/bmp": "bmp",
};
const EXT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };

/** A path inside the book, resolved against the file that refers to it. */
function resolveIn(base: string, href: string): string {
  const parts = base.split("/").slice(0, -1);
  for (const seg of href.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function decodePath(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

/** A front matter value, quoted when YAML would read it differently. */
const yamlValue = (v: string) => (/^[\w .,'()&-]+$/u.test(v) && !/^\d/.test(v) ? v : JSON.stringify(v));

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
/** Elements by local name, whatever their namespace prefix (dc:title, opf:item…). */
const byName = (root: Document | Element, name: string) => [...root.getElementsByTagName("*")].filter((el) => el.localName === name);

export async function epubToMarkdown(data: ArrayBuffer, baseName = "image"): Promise<ConversionResult> {
  const zip = await JSZip.loadAsync(data);
  const read = (path: string) => zip.file(path)?.async("string");
  if (zip.file("META-INF/encryption.xml")) {
    const enc = (await read("META-INF/encryption.xml")) ?? "";
    // Fonts may be obfuscated (allowed, harmless); anything else means DRM.
    const encrypted = byName(xml(enc), "CipherReference").map((c) => c.getAttribute("URI") ?? "");
    if (encrypted.some((uri) => !/\.(?:otf|ttf|woff2?)$/i.test(uri))) {
      return { markdown: "", images: [], warnings: ["This e-book is protected with DRM, so its text can't be read."] };
    }
  }
  const container = await read("META-INF/container.xml");
  const opfPath = container && byName(xml(container), "rootfile")[0]?.getAttribute("full-path");
  const opfText = opfPath && (await read(opfPath));
  if (!opfPath || !opfText) throw new Error("Not an EPUB: no package document");
  const opf = xml(opfText);

  const manifest = new Map<string, { href: string; type: string; properties: string }>();
  for (const item of byName(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href: resolveIn(opfPath, decodePath(href)), type: item.getAttribute("media-type") ?? "", properties: item.getAttribute("properties") ?? "" });
  }
  const chapters = byName(opf, "itemref")
    .map((ref) => manifest.get(ref.getAttribute("idref") ?? ""))
    .filter((it): it is NonNullable<typeof it> => !!it && /html/.test(it.type) && !it.properties.split(/\s+/).includes("nav"));

  const meta = (name: string) => byName(opf, name)[0]?.textContent?.replace(/\s+/g, " ").trim() || undefined;
  const title = meta("title");
  const author = byName(opf, "creator").map((c) => c.textContent?.trim()).filter(Boolean).join(", ") || undefined;
  const language = meta("language");

  const stem = baseName.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "image";
  const images: ExtractedImage[] = [];
  const imageNames = new Map<string, string>();
  const warnings: string[] = [];
  const chapterFiles = new Set(chapters.map((c) => c.href));
  const parsed: { href: string; doc: Document }[] = [];
  for (const chapter of chapters) {
    const text = await read(chapter.href);
    if (text === undefined) {
      warnings.push(`A chapter is missing from the book (${chapter.href}).`);
      continue;
    }
    parsed.push({ href: chapter.href, doc: new DOMParser().parseFromString(text, "text/html") });
  }

  // Each chapter starts at an anchor, so links to a chapter (without #…) still lead somewhere.
  const chapterAnchor = new Map<string, string>();
  parsed.forEach(({ href, doc }, i) => {
    const first = doc.body.querySelector("h1, h2, h3, h4, h5, h6");
    if (first && !first.id) first.id = `chapter-${i + 1}`;
    chapterAnchor.set(href, first?.id ?? "");
  });

  const bodies: string[] = [];
  for (const { href, doc } of parsed) {
    const body = doc.body;
    // Pictures: <img src> and SVG <image href> (cover pages often use the latter).
    const pictures: { el: Element; attr: string }[] = [
      ...[...body.querySelectorAll("img")].map((el) => ({ el, attr: "src" })),
      ...[...body.getElementsByTagName("image")].map((el) => ({ el, attr: el.hasAttribute("href") ? "href" : "xlink:href" })),
    ];
    for (const { el, attr } of pictures) {
      const src = el.getAttribute(attr) ?? "";
      if (!src || /^[a-z][\w+.-]*:/i.test(src)) continue;
      const path = resolveIn(href, decodePath(src.split("#")[0]));
      let name = imageNames.get(path);
      if (!name) {
        const file = zip.file(path);
        if (!file) {
          warnings.push(`A picture is missing from the book (${path}).`);
          continue;
        }
        const ext = path.split(".").pop()!.toLowerCase();
        const contentType = [...manifest.values()].find((m) => m.href === path)?.type || EXT_TYPE[ext] || "image/png";
        name = `${stem}-${images.length + 1}.${IMAGE_EXT[contentType] ?? ext}`;
        images.push({ name, base64: await file.async("base64"), contentType });
        imageNames.set(path, name);
      }
      if (el.localName === "img") el.setAttribute("src", `assets/${name}`);
      else {
        // An SVG wrapper becomes a plain picture.
        const img = doc.createElement("img");
        img.setAttribute("src", `assets/${name}`);
        img.setAttribute("alt", el.closest("svg")?.getAttribute("aria-label") ?? "");
        (el.closest("svg") ?? el).replaceWith(img);
      }
    }
    // Links to other chapters become links within the document.
    for (const a of body.querySelectorAll("a[href]")) {
      const link = a.getAttribute("href")!;
      if (/^[a-z][\w+.-]*:/i.test(link) || link.startsWith("#")) continue;
      const [file, fragment] = link.split("#");
      const target = resolveIn(href, decodePath(file));
      if (!chapterFiles.has(target)) continue;
      const anchor = fragment || chapterAnchor.get(target);
      if (anchor) a.setAttribute("href", `#${anchor}`);
      else a.replaceWith(...a.childNodes);
    }
    bodies.push(body.innerHTML);
  }

  let markdown = htmlToMarkdown(linksToHeadingAnchors(bodies.join("\n<hr>\n"))).trim();
  const front = [
    title && `title: ${yamlValue(title)}`,
    author && `author: ${yamlValue(author)}`,
    language && `lang: ${yamlValue(language)}`,
  ].filter(Boolean);
  if (front.length && markdown) markdown = `---\n${front.join("\n")}\n---\n\n${markdown}`;
  return { markdown: markdown ? `${markdown}\n` : "", images, warnings };
}
