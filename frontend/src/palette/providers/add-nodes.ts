import type { NodeDefinitionSummary } from "../comfy-adapter";
import { scoreTextMatch, sortPaletteResults } from "../scoring";
import type { PaletteProvider, PaletteResult } from "../types";
import type { UsageMetadata } from "../usage-store";

type AddNodesProviderAdapter = {
  readonly listNodeDefinitions: () => Promise<readonly NodeDefinitionSummary[]> | readonly NodeDefinitionSummary[];
  readonly startNativeAddNode: (nodeClass: string) => Promise<void> | void;
  readonly isAddNodeAvailable: () => boolean;
  readonly readHideApiNodes?: () => boolean;
  readonly readUsage: () => UsageMetadata;
  readonly recordNodeUse: (nodeClass: string, now: number) => void;
};

const PROVIDER_ID = "addNodes";
const GROUP = "Add Node";
const LOCAL_RESULT_LIMIT = 50;
const DISABLED_REASON = "Add-node placement is pending runtime verification";
const COMMON_NODE_CLASSES = new Set([
  "KSampler",
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "VAEDecode",
  "VAEEncode",
  "EmptyLatentImage",
  "SaveImage",
  "LoadImage",
  "PreviewImage",
]);

export function createAddNodesProvider(adapter: AddNodesProviderAdapter): PaletteProvider {
  let cachedDefinitions: Promise<readonly NodeDefinitionSummary[]> | null = null;

  const loadDefinitions = (): Promise<readonly NodeDefinitionSummary[]> => {
    cachedDefinitions ??= Promise.resolve(adapter.listNodeDefinitions());
    return cachedDefinitions;
  };

  return {
    id: PROVIDER_ID,
    group: GROUP,
    async search(query, context) {
      const usage = adapter.readUsage();
      const definitions = await loadDefinitions();
      const hideApiNodes = adapter.readHideApiNodes?.() === true;
      const isAvailable = adapter.isAddNodeAvailable();
      const matches = definitions.flatMap((definition): readonly PaletteResult[] => {
        if (hideApiNodes && definition.isApiNode) {
          return [];
        }

        const keywords = createKeywords(definition);
        const matchScore = scoreTextMatch(definition.displayName, keywords, query.term);

        if (matchScore === 0) {
          return [];
        }

        const score =
          matchScore +
          usageScore(usage, definition.nodeClass, query.term) +
          commonNodeScore(definition.nodeClass, query.term);

        return [
          {
            id: `add-node:${definition.nodeClass}`,
            providerId: PROVIDER_ID,
            title: definition.displayName,
            subtitle: createSubtitle(definition),
            keywords,
            score,
            group: GROUP,
            disabledReason: isAvailable ? undefined : DISABLED_REASON,
            detail: {
              heading: definition.displayName,
              lines: createDetailLines(definition),
            },
            execute: async () => {
              if (!isAvailable) {
                return;
              }

              await adapter.startNativeAddNode(definition.nodeClass);
              adapter.recordNodeUse(definition.nodeClass, context.now());
            },
          },
        ];
      });

      return sortPaletteResults(matches).slice(0, LOCAL_RESULT_LIMIT);
    },
  };
}

function createKeywords(definition: NodeDefinitionSummary): readonly string[] {
  return [definition.nodeClass, definition.category, definition.description].filter((value) => value.length > 0);
}

function createSubtitle(definition: NodeDefinitionSummary): string {
  if (definition.category.length === 0) {
    return definition.nodeClass;
  }

  return `${definition.category} / ${definition.nodeClass}`;
}

function createDetailLines(definition: NodeDefinitionSummary): readonly string[] {
  return [definition.nodeClass, definition.category, definition.description].filter((value) => value.length > 0);
}

function usageScore(usage: UsageMetadata, nodeClass: string, queryTerm: string): number {
  const entry = usage.nodeUsage[nodeClass];

  if (entry === undefined) {
    return 0;
  }

  if (queryTerm.trim().length === 0) {
    return Math.min(entry.count, 50) * 100 + Math.min(Math.floor(entry.lastUsedAt / 1_000), 99);
  }

  return Math.min(entry.count, 20) + Math.min(Math.floor(entry.lastUsedAt / 100_000), 5);
}

function commonNodeScore(nodeClass: string, queryTerm: string): number {
  if (!COMMON_NODE_CLASSES.has(nodeClass)) {
    return 0;
  }

  return queryTerm.trim().length === 0 ? 50 : 1;
}
