import { parsePaletteQuery } from "./query";
import { sortPaletteResults } from "./scoring";
import type { PaletteProvider, PaletteProviderContext, PaletteProviderId, PaletteResult } from "./types";

const DEFAULT_PROVIDER_ORDER: readonly PaletteProviderId[] = [
  "commands",
  "workflows",
  "graphNodes",
  "addNodes",
  "help",
];

export class ProviderRegistry {
  private readonly providers: ReadonlyMap<PaletteProviderId, PaletteProvider>;

  constructor(providers: readonly PaletteProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
  }

  async search(input: string, context: PaletteProviderContext): Promise<readonly PaletteResult[]> {
    const query = parsePaletteQuery(input);

    if (query.prefix !== "all") {
      const provider = this.providers.get(query.prefix);
      const results = provider === undefined ? [] : await safeSearch(provider, query, context);
      return sortPaletteResults(results);
    }

    const grouped = await Promise.all(
      DEFAULT_PROVIDER_ORDER.map(async (providerId) => {
        const provider = this.providers.get(providerId);
        if (provider === undefined) {
          return [];
        }

        const results = await safeSearch(provider, query, context);
        return sortPaletteResults(results).slice(0, providerCap(providerId));
      }),
    );

    return grouped.flatMap((results) => results);
  }
}

function providerCap(providerId: PaletteProviderId): number {
  if (providerId === "addNodes") {
    return 12;
  }

  return 8;
}

async function safeSearch(
  provider: PaletteProvider,
  query: Parameters<PaletteProvider["search"]>[0],
  context: PaletteProviderContext,
): Promise<readonly PaletteResult[]> {
  try {
    return await provider.search(query, context);
  } catch {
    return [];
  }
}
