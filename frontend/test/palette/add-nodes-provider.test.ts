import { afterEach, describe, expect, it, vi } from "vitest";
import { ComfyAdapter, type ApiLike, type CanvasLike, type NodeDefinitionSummary } from "../../src/palette/comfy-adapter";
import { createAddNodesProvider } from "../../src/palette/providers/add-nodes";
import type { UsageMetadata } from "../../src/palette/usage-store";

const emptyUsage: UsageMetadata = {
  version: 1,
  nodeUsage: {},
  commandUsage: {},
};

afterEach(() => {
  globalThis.LiteGraph = undefined;
});

function arbitraryNode(index: number): NodeDefinitionSummary {
  const suffix = index.toString().padStart(2, "0");

  return {
    nodeClass: `ArbitraryNode${suffix}`,
    displayName: `A Arbitrary Node ${suffix}`,
    category: "",
    description: "",
  };
}

describe("ComfyAdapter node definitions", () => {
  it("preserves the api receiver when reading node definitions from getNodeDefs", async () => {
    const adapter = new ComfyAdapter({
      api: new ReceiverSensitiveNodeDefsApi(),
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "ReceiverNode",
        displayName: "Receiver Node",
        category: "receiver",
        description: "",
        isApiNode: false,
      },
    ]);
  });

  it("lists node definitions from getNodeDefs with display fallbacks", async () => {
    const adapter = new ComfyAdapter({
      api: {
        getNodeDefs: () => ({
          KSampler: {
            display_name: "KSampler",
            category: "sampling",
            description: "Uses a sampler to denoise latents.",
          },
          CheckpointLoaderSimple: {
            name: "Load Checkpoint",
          },
        }),
      },
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "KSampler",
        displayName: "KSampler",
        category: "sampling",
        description: "Uses a sampler to denoise latents.",
        isApiNode: false,
      },
      {
        nodeClass: "CheckpointLoaderSimple",
        displayName: "Load Checkpoint",
        category: "",
        description: "",
        isApiNode: false,
      },
    ]);
  });

  it("merges frontend-only LiteGraph node types into node definitions", async () => {
    globalThis.LiteGraph = {
      registered_node_types: {
        "frontend/Note": {
          title: "Note",
          category: "utils",
        },
        "frontend/Markdown Note": {
          title: "Markdown Note",
          category: "utils",
        },
      },
    };
    const adapter = new ComfyAdapter({
      api: {
        getNodeDefs: () => ({
          KSampler: {
            display_name: "KSampler",
            category: "sampling",
          },
        }),
      },
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "KSampler",
        displayName: "KSampler",
        category: "sampling",
        description: "",
        isApiNode: false,
      },
      {
        nodeClass: "frontend/Note",
        displayName: "Note",
        category: "utils",
        description: "",
        isApiNode: false,
      },
      {
        nodeClass: "frontend/Markdown Note",
        displayName: "Markdown Note",
        category: "utils",
        description: "",
        isApiNode: false,
      },
    ]);
  });

  it("marks API-only node definitions so they can be hidden from add-node search", async () => {
    const adapter = new ComfyAdapter({
      api: {
        getNodeDefs: () => ({
          ApiOnlyNode: {
            display_name: "API Only Node",
            category: "api",
            api_node: true,
          },
        }),
      },
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "ApiOnlyNode",
        displayName: "API Only Node",
        category: "api",
        description: "",
        isApiNode: true,
      },
    ]);
  });

  it("falls back to /object_info when getNodeDefs is unavailable", async () => {
    const response = new Response(
      JSON.stringify({
        EmptyLatentImage: {
          display_name: "Empty Latent Image",
          category: "latent",
        },
      }),
    );
    const fetchApi = vi.fn<(route: string) => Response>(() => response);
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "EmptyLatentImage",
        displayName: "Empty Latent Image",
        category: "latent",
        description: "",
        isApiNode: false,
      },
    ]);
    expect(fetchApi).toHaveBeenCalledWith("/object_info");
  });

  it("preserves the api receiver when falling back to fetchApi for node definitions", async () => {
    const adapter = new ComfyAdapter({
      api: new ReceiverSensitiveObjectInfoApi(),
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([
      {
        nodeClass: "ReceiverObjectInfoNode",
        displayName: "Receiver Object Info Node",
        category: "receiver",
        description: "",
        isApiNode: false,
      },
    ]);
  });

  it("returns an empty list for invalid getNodeDefs payloads", async () => {
    const adapter = new ComfyAdapter({
      api: {
        getNodeDefs: () => null,
      },
    });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([]);
  });

  it("returns an empty list when /object_info response is not ok", async () => {
    const fetchApi = vi.fn<(route: string) => Response>(() => new Response("nope", { status: 500 }));
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.listNodeDefinitions()).resolves.toEqual([]);
    expect(fetchApi).toHaveBeenCalledWith("/object_info");
  });

  it("keeps native add-node unavailable when graph creation APIs are missing", async () => {
    const adapter = new ComfyAdapter({});

    expect(adapter.canStartNativeAddNode()).toBe(false);
    await expect(adapter.startNativeAddNode("KSampler")).rejects.toThrow(
      "Cannot add node because active graph is unavailable: KSampler",
    );
  });

  it("adds a LiteGraph node to the active graph at the visible viewport center", async () => {
    const node = { id: 99, type: "KSampler", pos: [0, 0] as [number, number] };
    const nodes: typeof node[] = [];
    const add = vi.fn<(entry: typeof node) => void>((entry) => {
      nodes.push(entry);
    });
    const selectItems = vi.fn<NonNullable<CanvasLike["selectItems"]>>();
    const setDirty = vi.fn<NonNullable<CanvasLike["setDirty"]>>();
    const createNode = vi.fn<(nodeClass: string) => typeof node>(() => node);
    globalThis.LiteGraph = { createNode };
    const adapter = new ComfyAdapter({
      canvas: {
        graph: {
          nodes,
          add,
        },
        ds: {
          visible_area: { 0: 100, 1: 200, 2: 800, 3: 600 },
        },
        selectItems,
        setDirty,
      },
    });

    expect(adapter.canStartNativeAddNode()).toBe(true);

    await adapter.startNativeAddNode("KSampler");

    expect(createNode).toHaveBeenCalledWith("KSampler");
    expect(node.pos).toEqual([500, 500]);
    expect(add).toHaveBeenCalledWith(node);
    expect(selectItems).toHaveBeenCalledWith([node]);
    expect(setDirty).toHaveBeenCalledWith(true, true);
  });

  it("throws a clear add-node error when LiteGraph createNode is unavailable", async () => {
    const adapter = new ComfyAdapter({
      canvas: {
        graph: {
          nodes: [],
          add: () => undefined,
        },
      },
    });

    expect(adapter.canStartNativeAddNode()).toBe(false);
    await expect(adapter.startNativeAddNode("KSampler")).rejects.toThrow(
      "Cannot add node because LiteGraph.createNode is unavailable: KSampler",
    );
  });

  it("throws a clear add-node error when the active graph cannot add nodes", async () => {
    const adapter = new ComfyAdapter({
      canvas: {
        graph: {
          nodes: [],
        },
      },
    });

    expect(adapter.canStartNativeAddNode()).toBe(false);
    await expect(adapter.startNativeAddNode("KSampler")).rejects.toThrow(
      "Cannot add node because active graph add() is unavailable: KSampler",
    );
  });

  it("throws a clear add-node error when node creation returns empty", async () => {
    globalThis.LiteGraph = { createNode: () => null };
    const adapter = new ComfyAdapter({
      canvas: {
        graph: {
          nodes: [],
          add: () => undefined,
        },
      },
    });

    await expect(adapter.startNativeAddNode("KSampler")).rejects.toThrow(
      "Cannot add node because LiteGraph.createNode returned no node: KSampler",
    );
  });
});

class ReceiverSensitiveNodeDefsApi implements ApiLike {
  readonly marker = "node-defs-api";

  getNodeDefs(): ReturnType<NonNullable<ApiLike["getNodeDefs"]>> {
    this.assertReceiver("getNodeDefs");
    return {
      ReceiverNode: {
        display_name: "Receiver Node",
        category: "receiver",
      },
    };
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "node-defs-api") {
      throw new Error(`${method} lost receiver`);
    }
  }
}

class ReceiverSensitiveObjectInfoApi implements ApiLike {
  readonly marker = "object-info-api";

  fetchApi(route: string): Response {
    this.assertReceiver("fetchApi");
    expect(route).toBe("/object_info");
    return new Response(
      JSON.stringify({
        ReceiverObjectInfoNode: {
          display_name: "Receiver Object Info Node",
          category: "receiver",
        },
      }),
    );
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "object-info-api") {
      throw new Error(`${method} lost receiver`);
    }
  }
}

describe("createAddNodesProvider", () => {
  it("matches node definitions by query and returns KSampler for + sampler", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        {
          nodeClass: "KSampler",
          displayName: "KSampler",
          category: "sampling",
          description: "Uses a sampler to denoise latents.",
        },
        {
          nodeClass: "CheckpointLoaderSimple",
          displayName: "Load Checkpoint",
          category: "loaders",
          description: "Loads checkpoints.",
        },
      ],
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: () => undefined,
    });

    const results = await provider.search(
      { raw: "+ sampler", prefix: "addNodes", term: "sampler" },
      { now: () => 100 },
    );

    expect(results.map((result) => result.id)).toEqual(["add-node:KSampler"]);
    expect(results[0]).toMatchObject({
      providerId: "addNodes",
      title: "KSampler",
      subtitle: "sampling / KSampler",
      group: "Add Node",
      keywords: ["KSampler", "sampling", "Uses a sampler to denoise latents."],
    });
  });

  it("executes by starting native add-node flow and then recording node use", async () => {
    const events: string[] = [];
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        { nodeClass: "KSampler", displayName: "KSampler", category: "sampling", description: "" },
      ],
      startNativeAddNode: async (nodeClass: string) => {
        events.push(`start:${nodeClass}`);
      },
      isAddNodeAvailable: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: (nodeClass: string, now: number) => {
        events.push(`record:${nodeClass}:${now}`);
      },
    });

    const results = await provider.search(
      { raw: "+ sampler", prefix: "addNodes", term: "sampler" },
      { now: () => 123 },
    );

    await results[0]?.execute();

    expect(events).toEqual(["start:KSampler", "record:KSampler:123"]);
  });

  it("marks results disabled and skips usage recording when add-node is unavailable", async () => {
    const startNativeAddNode = vi.fn<(nodeClass: string) => void>();
    const recordNodeUse = vi.fn<(nodeClass: string, now: number) => void>();
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        { nodeClass: "KSampler", displayName: "KSampler", category: "sampling", description: "" },
      ],
      startNativeAddNode,
      isAddNodeAvailable: () => false,
      readUsage: () => emptyUsage,
      recordNodeUse,
    });

    const results = await provider.search(
      { raw: "+ sampler", prefix: "addNodes", term: "sampler" },
      { now: () => 123 },
    );

    expect(results[0]?.disabledReason).toBe("Add-node placement is pending runtime verification");
    await results[0]?.execute();
    expect(startNativeAddNode).not.toHaveBeenCalled();
    expect(recordNodeUse).not.toHaveBeenCalled();
  });

  it("uses usage metadata to boost frequently used nodes", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        { nodeClass: "AlphaNode", displayName: "Alpha Node", category: "", description: "" },
        { nodeClass: "KSampler", displayName: "KSampler", category: "sampling", description: "" },
      ],
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => ({
        version: 1,
        nodeUsage: {
          AlphaNode: { count: 8, lastUsedAt: 200 },
        },
        commandUsage: {},
      }),
      recordNodeUse: () => undefined,
    });

    const results = await provider.search({ raw: "+", prefix: "addNodes", term: "" }, { now: () => 500 });

    expect(results.map((result) => result.id)).toEqual(["add-node:AlphaNode", "add-node:KSampler"]);
  });

  it("keeps title relevance ahead of high-usage weak matches for non-empty queries", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        { nodeClass: "SamplerExact", displayName: "Sampler", category: "", description: "" },
        { nodeClass: "SamplerPrefix", displayName: "Sampler Prefix", category: "", description: "" },
        { nodeClass: "WeakUsedSampler", displayName: "ZZZ Weak Used", category: "sampler", description: "" },
      ],
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => ({
        version: 1,
        nodeUsage: {
          WeakUsedSampler: { count: 999, lastUsedAt: 999_999 },
        },
        commandUsage: {},
      }),
      recordNodeUse: () => undefined,
    });

    const results = await provider.search(
      { raw: "+ sampler", prefix: "addNodes", term: "sampler" },
      { now: () => 1_000_000 },
    );

    expect(results.map((result) => result.id)).toEqual([
      "add-node:SamplerExact",
      "add-node:SamplerPrefix",
      "add-node:WeakUsedSampler",
    ]);
  });

  it("loads node definitions once for repeated searches", async () => {
    const listNodeDefinitions = vi.fn<() => readonly NodeDefinitionSummary[]>(() => [
      { nodeClass: "KSampler", displayName: "KSampler", category: "sampling", description: "" },
    ]);
    const provider = createAddNodesProvider({
      listNodeDefinitions,
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: () => undefined,
    });

    await provider.search({ raw: "+ sampler", prefix: "addNodes", term: "sampler" }, { now: () => 500 });
    await provider.search({ raw: "+ latent", prefix: "addNodes", term: "latent" }, { now: () => 501 });

    expect(listNodeDefinitions).toHaveBeenCalledTimes(1);
  });

  it("keeps common nodes visible for empty queries among many arbitrary unused nodes", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        ...Array.from({ length: 60 }, (_, index) => arbitraryNode(index)),
        { nodeClass: "KSampler", displayName: "KSampler", category: "sampling", description: "" },
      ],
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: () => undefined,
    });

    const results = await provider.search({ raw: "+", prefix: "addNodes", term: "" }, { now: () => 500 });

    expect(results.slice(0, 10).map((result) => result.id)).toContain("add-node:KSampler");
  });

  it("caps results to 50 entries", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => Array.from({ length: 60 }, (_, index) => arbitraryNode(index)),
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: () => undefined,
    });

    const results = await provider.search({ raw: "+", prefix: "addNodes", term: "" }, { now: () => 500 });

    expect(results).toHaveLength(50);
  });

  it("hides API nodes when the custom setting is enabled", async () => {
    const provider = createAddNodesProvider({
      listNodeDefinitions: async () => [
        {
          nodeClass: "VisibleNode",
          displayName: "Visible Node",
          category: "",
          description: "",
          isApiNode: false,
        },
        {
          nodeClass: "ApiOnlyNode",
          displayName: "API Only Node",
          category: "api",
          description: "",
          isApiNode: true,
        },
      ],
      startNativeAddNode: () => undefined,
      isAddNodeAvailable: () => true,
      readHideApiNodes: () => true,
      readUsage: () => emptyUsage,
      recordNodeUse: () => undefined,
    });

    const results = await provider.search({ raw: "+", prefix: "addNodes", term: "" }, { now: () => 500 });

    expect(results.map((result) => result.id)).toEqual(["add-node:VisibleNode"]);
  });
});
