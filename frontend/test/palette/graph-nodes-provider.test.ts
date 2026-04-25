import { describe, expect, it, vi } from "vitest";
import { ComfyAdapter } from "../../src/palette/comfy-adapter";
import { createGraphNodesProvider } from "../../src/palette/providers/graph-nodes";

describe("ComfyAdapter graph nodes", () => {
  it("lists active graph nodes from the canvas graph with fallbacks", () => {
    const adapter = new ComfyAdapter({
      canvas: {
        graph: {
          nodes: [
            { id: 12, title: "KSampler", type: "KSampler", comfyClass: "KSamplerAdvanced" },
            { id: 13, type: "CheckpointLoaderSimple" },
          ],
        },
      },
    });

    expect(adapter.listActiveGraphNodes()).toEqual([
      { id: 12, title: "KSampler", type: "KSampler", nodeClass: "KSamplerAdvanced" },
      { id: 13, title: "13", type: "CheckpointLoaderSimple", nodeClass: "CheckpointLoaderSimple" },
    ]);
  });

  it("selects and frames a node by id with the provided zoom", () => {
    const selectItems = vi.fn<(nodes: object[]) => void>();
    const animateToBounds = vi.fn<(bounds: object, options: { duration: number; zoom: number }) => void>();
    const node = {
      id: 12,
      title: "KSampler",
      type: "KSampler",
      boundingRect: [10, 20, 300, 200],
    };
    const adapter = new ComfyAdapter({
      canvas: {
        graph: { nodes: [node] },
        selectItems,
        animateToBounds,
      },
    });

    adapter.selectAndFrameNode(12, { zoom: 0.72 });

    expect(selectItems).toHaveBeenCalledWith([node]);
    expect(animateToBounds).toHaveBeenCalledWith(node.boundingRect, { duration: 250, zoom: 0.72 });
  });
});

describe("createGraphNodesProvider", () => {
  it("matches active graph nodes by title and id", async () => {
    const provider = createGraphNodesProvider({
      listActiveGraphNodes: () => [
        { id: 12, title: "Main Sampler", type: "KSampler", nodeClass: "KSamplerAdvanced" },
        { id: 20, title: "Checkpoint", type: "CheckpointLoaderSimple", nodeClass: "CheckpointLoaderSimple" },
      ],
      selectAndFrameNode: () => undefined,
    });

    const titleResults = await provider.search(
      { raw: "@ sampler", prefix: "graphNodes", term: "sampler" },
      { now: () => 100 },
    );
    const idResults = await provider.search(
      { raw: "@ 12", prefix: "graphNodes", term: "12" },
      { now: () => 100 },
    );

    expect(titleResults.map((result) => result.id)).toEqual(["graph-node:12"]);
    expect(idResults.map((result) => result.id)).toEqual(["graph-node:12"]);
    expect(idResults[0]).toMatchObject({
      providerId: "graphNodes",
      title: "Main Sampler",
      subtitle: "#12 KSamplerAdvanced",
      group: "Current Graph Nodes",
      keywords: ["12", "KSampler", "KSamplerAdvanced"],
      score: 1000,
    });
  });

  it("executes by selecting and framing the node", async () => {
    const selectAndFrameNode = vi.fn<(nodeId: number) => void>();
    const provider = createGraphNodesProvider({
      listActiveGraphNodes: () => [
        { id: 12, title: "Main Sampler", type: "KSampler", nodeClass: "KSamplerAdvanced" },
      ],
      selectAndFrameNode,
      readNodeJumpZoom: () => 0.85,
    });

    const results = await provider.search(
      { raw: "@ 12", prefix: "graphNodes", term: "12" },
      { now: () => 100 },
    );

    await results[0]?.execute();

    expect(selectAndFrameNode).toHaveBeenCalledWith(12, { zoom: 0.85 });
  });
});
