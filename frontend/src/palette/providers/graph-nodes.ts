import type { ActiveGraphNode } from "../comfy-adapter";
import { scoreTextMatch, sortPaletteResults } from "../scoring";
import type { PaletteProvider, PaletteResult } from "../types";

type GraphNodesProviderAdapter = {
  readonly listActiveGraphNodes: () => readonly ActiveGraphNode[];
  readonly selectAndFrameNode: (nodeId: number, options: { readonly zoom: number }) => void;
  readonly readNodeJumpZoom?: () => number;
};

export function createGraphNodesProvider(adapter: GraphNodesProviderAdapter): PaletteProvider {
  return {
    id: "graphNodes",
    group: "Current Graph Nodes",
    async search(query) {
      const matches = adapter.listActiveGraphNodes().flatMap((node): readonly PaletteResult[] => {
        const title = node.title.length === 0 ? node.nodeClass : node.title;
        const keywords = [String(node.id), node.type, node.nodeClass].filter((value) => value.length > 0);
        const score = Math.max(
          scoreTextMatch(title, keywords, query.term),
          query.term === String(node.id) ? 1000 : 0,
        );

        if (score === 0) {
          return [];
        }

        return [
          {
            id: `graph-node:${node.id}`,
            providerId: "graphNodes",
            title,
            subtitle: `#${node.id} ${node.nodeClass}`,
            keywords,
            score,
            group: "Current Graph Nodes",
            execute: () => adapter.selectAndFrameNode(node.id, { zoom: adapter.readNodeJumpZoom?.() ?? 0.75 }),
          },
        ];
      });

      return sortPaletteResults(matches);
    },
  };
}
