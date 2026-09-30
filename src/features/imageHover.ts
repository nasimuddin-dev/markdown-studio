import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { backend } from "../services";
import { resolveRelative } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { findAllLinks } from "./lint";

/** Loaded pictures by path, shared by every hover (data URLs). */
const cache = new Map<string, Promise<string | null>>();

/** The image link at `pos` (`![alt](path)`, a reference definition to a picture, or `<img src>`), if any. */
export function imageAt(text: string, pos: number): { from: number; to: number; src: string } | null {
  for (const link of findAllLinks(text)) {
    if (pos < link.from || pos > link.to || !link.target) continue;
    if (link.image || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(link.target.split(/[?#]/)[0])) return { from: link.from, to: link.to, src: link.target };
  }
  return null;
}

/** Where to load an image from: web and data addresses as they are, local paths through the backend. */
async function imageUrl(src: string, docPath: string | null): Promise<string | null> {
  if (/^(https?:|data:image\/)/i.test(src)) return src;
  const path = docPath ? resolveRelative(docPath, src) : null;
  if (!path) return null;
  if (!cache.has(path)) cache.set(path, backend().readImage(path).catch(() => null));
  const url = await cache.get(path)!;
  // A missing picture may be added later; try again next time.
  if (!url) cache.delete(path);
  return url;
}

/** Hovering an image link in the editor shows the picture. */
export function imageHover(): Extension {
  return hoverTooltip(
    async (view, pos): Promise<Tooltip | null> => {
      const hit = imageAt(view.state.doc.toString(), pos);
      if (!hit) return null;
      const url = await imageUrl(hit.src, activeDoc()?.path ?? null);
      return {
        pos: hit.from,
        end: hit.to,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-image-preview";
          if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            dom.append(img);
          } else {
            dom.textContent = activeDoc()?.path ? "Image not found" : "Save the document to preview local images";
          }
          return { dom };
        },
      };
    },
    { hoverTime: 350 },
  );
}
