import { describe, expect, it } from "vitest";
import { parsePaletteQuery } from "../../src/palette/query";

describe("parsePaletteQuery", () => {
  it("parses no-prefix search", () => {
    expect(parsePaletteQuery("save workflow")).toEqual({
      raw: "save workflow",
      prefix: "all",
      term: "save workflow",
    });
  });

  it("parses command prefix", () => {
    expect(parsePaletteQuery("> zoom")).toEqual({
      raw: "> zoom",
      prefix: "commands",
      term: "zoom",
    });
  });

  it("parses active graph node prefix", () => {
    expect(parsePaletteQuery("@ 12")).toEqual({
      raw: "@ 12",
      prefix: "graphNodes",
      term: "12",
    });
  });

  it("parses add-node prefix", () => {
    expect(parsePaletteQuery("+ checkpoint")).toEqual({
      raw: "+ checkpoint",
      prefix: "addNodes",
      term: "checkpoint",
    });
  });

  it("parses workflow prefix", () => {
    expect(parsePaletteQuery("# anime")).toEqual({
      raw: "# anime",
      prefix: "workflows",
      term: "anime",
    });
  });

  it("parses help prefix", () => {
    expect(parsePaletteQuery("? shortcuts")).toEqual({
      raw: "? shortcuts",
      prefix: "help",
      term: "shortcuts",
    });
  });

  it("keeps double-at as active graph search for V1", () => {
    expect(parsePaletteQuery("@@ sampler")).toEqual({
      raw: "@@ sampler",
      prefix: "graphNodes",
      term: "@ sampler",
    });
  });
});
