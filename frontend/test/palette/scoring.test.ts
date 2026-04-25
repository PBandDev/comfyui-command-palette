import { describe, expect, it } from "vitest";
import { scoreTextMatch, sortPaletteResults } from "../../src/palette/scoring";
import type { PaletteResult } from "../../src/palette/types";

function result(id: string, title: string, score: number): PaletteResult {
  return {
    id,
    providerId: "commands",
    title,
    keywords: [],
    score,
    group: "Commands",
    execute: () => undefined,
  };
}

describe("scoreTextMatch", () => {
  it("returns one for an empty query", () => {
    expect(scoreTextMatch("Save Workflow", ["workflow"], "")).toBe(1);
  });

  it("rewards exact matches above prefix matches", () => {
    expect(scoreTextMatch("Save", ["workflow"], "save")).toBeGreaterThan(
      scoreTextMatch("Save Workflow", [], "save"),
    );
  });

  it("rewards hyphen and slash word boundaries above plain contains", () => {
    expect(scoreTextMatch("Load-Image", [], "image")).toBeGreaterThan(
      scoreTextMatch("LoadImage", [], "image"),
    );
    expect(scoreTextMatch("Open/Close", [], "close")).toBeGreaterThan(
      scoreTextMatch("OpenClose", [], "close"),
    );
  });

  it("rewards unicode word boundaries above plain contains", () => {
    expect(scoreTextMatch("Open/关闭X", [], "关闭")).toBeGreaterThan(
      scoreTextMatch("Open关闭X", [], "关闭"),
    );
  });

  it("rewards keyword matches", () => {
    expect(scoreTextMatch("Zoom to Fit", ["frame graph"], "frame")).toBeGreaterThan(0);
  });

  it("matches command phrases when the query includes workflow filler words", () => {
    expect(scoreTextMatch("Close", ["Close Workflow"], "close current workflow")).toBeGreaterThan(0);
  });

  it("rewards keyword exact matches above keyword contains", () => {
    expect(scoreTextMatch("Zoom to Fit", ["frame graph"], "frame graph")).toBeGreaterThan(
      scoreTextMatch("Zoom to Fit", ["frame graph"], "frame"),
    );
  });

  it("returns zero for unrelated text", () => {
    expect(scoreTextMatch("Save Workflow", [], "banana")).toBe(0);
  });
});

describe("sortPaletteResults", () => {
  it("sorts by score and then title", () => {
    expect(sortPaletteResults([
      result("b", "Beta", 3),
      result("a", "Alpha", 3),
      result("c", "Gamma", 9),
    ]).map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });

  it("uses deterministic normalized title ordering for ties", () => {
    expect(sortPaletteResults([
      result("b", "beta", 3),
      result("a", "Alpha", 3),
    ]).map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});
