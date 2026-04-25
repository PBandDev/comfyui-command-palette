import type { CommandSummary } from "../comfy-adapter";
import { scoreTextMatch, sortPaletteResults } from "../scoring";
import type { PaletteProvider, PaletteResult } from "../types";

type CommandsProviderAdapter = {
  readonly listCommands: () => readonly CommandSummary[];
  readonly executeCommand: (commandId: string) => Promise<void> | void;
  readonly recordCommandUse: (commandId: string, now: number) => void;
};

export function createCommandsProvider(adapter: CommandsProviderAdapter): PaletteProvider {
  return {
    id: "commands",
    group: "Commands",
    async search(query, context) {
      const matches = adapter.listCommands().flatMap((command): readonly PaletteResult[] => {
        const score = scoreTextMatch(command.title, command.keywords, query.term);

        if (score === 0) {
          return [];
        }

        return [
          {
            id: `command:${command.commandId}`,
            providerId: "commands",
            title: command.title,
            subtitle: command.subtitle,
            keywords: command.keywords,
            shortcut: command.shortcut,
            score,
            group: "Commands",
            risky: command.risky ? true : undefined,
            execute: async () => {
              await adapter.executeCommand(command.commandId);
              adapter.recordCommandUse(command.commandId, context.now());
            },
          },
        ];
      });

      return sortPaletteResults(matches);
    },
  };
}
