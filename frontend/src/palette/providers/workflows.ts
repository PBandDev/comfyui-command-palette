import type { WorkflowEntry } from "../comfy-adapter";
import { scoreTextMatch, sortPaletteResults } from "../scoring";
import type { PaletteProvider, PaletteResult } from "../types";

type WorkflowsProviderAdapter = {
  readonly listWorkflowEntries: () => Promise<readonly WorkflowEntry[]> | readonly WorkflowEntry[];
  readonly loadWorkflow: (path: string) => Promise<void> | void;
  readonly loadTemplate: (path: string) => Promise<void> | void;
};

const PROVIDER_ID = "workflows";
const GROUP = "Workflows and Templates";

export function createWorkflowsProvider(adapter: WorkflowsProviderAdapter): PaletteProvider {
  return {
    id: PROVIDER_ID,
    group: GROUP,
    async search(query) {
      const entries = await adapter.listWorkflowEntries();
      const matches = entries.flatMap((entry): readonly PaletteResult[] => {
        const keywords = [entry.subtitle, entry.kind];
        const matchScore = scoreTextMatch(entry.title, keywords, query.term);

        if (matchScore === 0) {
          return [];
        }

        const score = matchScore + workflowKindBoost(entry.kind, query.term);

        return [
          {
            id: entry.id,
            providerId: PROVIDER_ID,
            title: entry.title,
            subtitle: entry.subtitle,
            keywords,
            score,
            group: entry.kind === "workflow" ? "Saved Workflows" : "Templates",
            execute: async () => {
              if (entry.kind === "workflow") {
                await adapter.loadWorkflow(entry.path);
                return;
              }

              await adapter.loadTemplate(entry.path);
            },
          },
        ];
      });

      return sortPaletteResults(matches);
    },
  };
}

function workflowKindBoost(kind: WorkflowEntry["kind"], queryTerm: string): number {
  if (kind !== "workflow") {
    return 0;
  }

  return queryTerm.trim().length === 0 ? 1000 : 5;
}
