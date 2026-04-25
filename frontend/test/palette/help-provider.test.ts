import { describe, expect, it, vi } from "vitest";
import { createHelpProvider } from "../../src/palette/providers/help";

describe("createHelpProvider", () => {
  it("returns a documentation entry for docs searches and opens the docs URL", async () => {
    const openUrl = vi.fn<(url: string) => void>();
    const provider = createHelpProvider({ openUrl, version: "1.0.0" });

    const results = await provider.search({ raw: "? docs", prefix: "help", term: "docs" }, { now: () => 100 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "help:docs",
      providerId: "help",
      title: "ComfyUI Documentation",
      keywords: ["docs", "manual", "help"],
      group: "Help",
      detail: {
        heading: "ComfyUI Documentation",
        lines: ["Official ComfyUI documentation."],
      },
    });

    await results[0]?.execute();

    expect(openUrl).toHaveBeenCalledWith("https://docs.comfy.org/");
  });

  it("returns about information and opens the GitHub repository", async () => {
    const openUrl = vi.fn<(url: string) => void>();
    const provider = createHelpProvider({ openUrl, version: "1.0.0" });

    const results = await provider.search({ raw: "? about", prefix: "help", term: "about" }, { now: () => 100 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "help:about",
      providerId: "help",
      title: "About Command Palette",
      subtitle: "Version 1.0.0",
      keywords: ["about", "version", "command palette"],
      group: "Help",
      detail: {
        heading: "About Command Palette",
        lines: [
          "Version 1.0.0",
          "Prefixes: > commands, @ graph nodes, + add nodes, # workflows, ? help.",
        ],
      },
    });

    await results[0]?.execute();

    expect(openUrl).toHaveBeenCalledWith("https://github.com/PBandDev/comfyui-command-palette");
  });

  it("keeps help searches limited to read-only help entries", async () => {
    const provider = createHelpProvider({ openUrl: () => undefined, version: "1.0.0" });

    const results = await provider.search({ raw: "?", prefix: "help", term: "" }, { now: () => 100 });

    expect(results.map((result) => result.title)).toEqual(["About Command Palette", "ComfyUI Documentation"]);
    expect(results.map((result) => result.risky)).toEqual([undefined, undefined]);
    expect(results.map((result) => result.title.toLowerCase()).join(" ")).not.toMatch(
      /settings|memory|unload|interrupt/,
    );
  });
});
