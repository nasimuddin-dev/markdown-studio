import { describe, expect, it } from "vitest";
import { writeConverted } from "../src/features/importing";
import { useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

describe("saving an imported document", () => {
  it("puts its images in the folder set in Settings and links them there", async () => {
    const backend = setupBackend({ "/ws/keep.md": "" });
    useSettings.getState().update({ imageFolder: "img" });
    try {
      await writeConverted("/ws/report.md", { markdown: "![Chart](assets/chart.png)\n", images: [{ name: "chart.png", base64: "iVBORw==" } as never], warnings: [] });
      expect((await backend.readTextFile("/ws/report.md")).content).toBe("![Chart](img/chart.png)\n");
      expect(await backend.readImage("/ws/img/chart.png")).toBe("data:image/png;base64,iVBORw==");
    } finally {
      useSettings.getState().update({ imageFolder: "assets" });
    }
  });

  it("keeps assets/ links by default", async () => {
    const backend = setupBackend({ "/ws/keep.md": "" });
    await writeConverted("/ws/r.md", { markdown: "![C](assets/c.png)\n", images: [{ name: "c.png", base64: "iVBORw==" } as never], warnings: [] });
    expect((await backend.readTextFile("/ws/r.md")).content).toBe("![C](assets/c.png)\n");
  });
});
