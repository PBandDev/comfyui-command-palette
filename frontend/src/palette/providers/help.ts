import { COMMAND_PALETTE_REPO_URL } from "../../constants";
import { scoreTextMatch, sortPaletteResults } from "../scoring";
import type { PaletteProvider, PaletteResult } from "../types";

type HelpProviderAdapter = {
  readonly openUrl: (url: string) => void;
  readonly version: string;
};

type HelpEntry = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly keywords: readonly string[];
  readonly detailLines: readonly string[];
  readonly url?: string;
};

const PROVIDER_ID = "help";
const GROUP = "Help";

export function createHelpProvider(adapter: HelpProviderAdapter): PaletteProvider {
  const entries: readonly HelpEntry[] = [
    {
      id: "help:docs",
      title: "ComfyUI Documentation",
      keywords: ["docs", "manual", "help"],
      detailLines: ["Official ComfyUI documentation."],
      url: "https://docs.comfy.org/",
    },
    {
      id: "help:about",
      title: "About Command Palette",
      subtitle: `Version ${adapter.version}`,
      keywords: ["about", "version", "command palette"],
      detailLines: [
        `Version ${adapter.version}`,
        "Prefixes: > commands, @ graph nodes, + add nodes, # workflows, ? help.",
      ],
      url: COMMAND_PALETTE_REPO_URL,
    },
  ];

  return {
    id: PROVIDER_ID,
    group: GROUP,
    async search(query) {
      const matches = entries.flatMap((entry): readonly PaletteResult[] => {
        const score = scoreTextMatch(entry.title, entry.keywords, query.term);

        if (score === 0) {
          return [];
        }

        return [
          {
            id: entry.id,
            providerId: PROVIDER_ID,
            title: entry.title,
            subtitle: entry.subtitle,
            keywords: entry.keywords,
            score,
            group: GROUP,
            detail: {
              heading: entry.title,
              lines: entry.detailLines,
            },
            execute: () => {
              if (entry.url !== undefined) {
                adapter.openUrl(entry.url);
              }
            },
          },
        ];
      });

      return sortPaletteResults(matches);
    },
  };
}
