import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../../src/palette/provider-registry";
import type { PaletteProvider, PaletteResult } from "../../src/palette/types";

function makeResult(id: string, providerId: PaletteResult["providerId"], score: number): PaletteResult {
  return {
    id,
    providerId,
    title: id,
    keywords: [],
    score,
    group: providerId,
    execute: () => undefined,
  };
}

function provider(id: PaletteProvider["id"], results: readonly PaletteResult[]): PaletteProvider {
  return {
    id,
    group: id,
    search: async () => results,
  };
}

function rejectingProvider(id: PaletteProvider["id"]): PaletteProvider {
  return {
    id,
    group: id,
    search: async () => {
      throw new Error(`${id} failed`);
    },
  };
}

describe("ProviderRegistry", () => {
  it("routes prefixed queries to one provider", async () => {
    const registry = new ProviderRegistry([
      provider("commands", [makeResult("save", "commands", 10)]),
      provider("addNodes", [makeResult("sampler", "addNodes", 10)]),
    ]);

    const results = await registry.search("> save", { now: () => 1 });

    expect(results.map((entry) => entry.id)).toEqual(["save"]);
  });

  it("returns empty results for a missing prefixed provider", async () => {
    const registry = new ProviderRegistry([
      provider("commands", [makeResult("save", "commands", 10)]),
    ]);

    const results = await registry.search("+ sampler", { now: () => 1 });

    expect(results).toEqual([]);
  });

  it("returns empty results for a failing prefixed provider", async () => {
    const registry = new ProviderRegistry([
      rejectingProvider("commands"),
    ]);

    const results = await registry.search("> save", { now: () => 1 });

    expect(results).toEqual([]);
  });

  it("searches all providers for no-prefix queries", async () => {
    const registry = new ProviderRegistry([
      provider("help", [makeResult("help", "help", 10)]),
      provider("addNodes", [makeResult("sampler", "addNodes", 9)]),
      provider("commands", [makeResult("save", "commands", 10)]),
      provider("graphNodes", [makeResult("node", "graphNodes", 8)]),
      provider("workflows", [makeResult("flow", "workflows", 7)]),
    ]);

    const results = await registry.search("s", { now: () => 1 });

    expect(results.map((entry) => entry.id)).toEqual(["save", "flow", "node", "sampler", "help"]);
  });

  it("skips a failing provider in no-prefix queries", async () => {
    const registry = new ProviderRegistry([
      provider("commands", [makeResult("save", "commands", 10)]),
      rejectingProvider("workflows"),
      provider("graphNodes", [makeResult("node", "graphNodes", 8)]),
    ]);

    const results = await registry.search("s", { now: () => 1 });

    expect(results.map((entry) => entry.id)).toEqual(["save", "node"]);
  });

  it("caps addNodes at 12 and other providers at 8", async () => {
    const registry = new ProviderRegistry([
      provider(
        "commands",
        Array.from({ length: 20 }, (_, index) => makeResult(`command-${index}`, "commands", 20 - index)),
      ),
      provider(
        "workflows",
        Array.from({ length: 20 }, (_, index) => makeResult(`workflow-${index}`, "workflows", 20 - index)),
      ),
      provider(
        "addNodes",
        Array.from({ length: 20 }, (_, index) => makeResult(`add-${index}`, "addNodes", 20 - index)),
      ),
    ]);

    const results = await registry.search("s", { now: () => 1 });

    expect(results.filter((entry) => entry.providerId === "commands")).toHaveLength(8);
    expect(results.filter((entry) => entry.providerId === "workflows")).toHaveLength(8);
    expect(results.filter((entry) => entry.providerId === "addNodes")).toHaveLength(12);
  });
});
