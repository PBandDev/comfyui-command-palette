export type PaletteProviderId = "commands" | "graphNodes" | "addNodes" | "workflows" | "help";
export type PaletteQueryPrefix = PaletteProviderId | "all";

export type PaletteResultDetail = {
  readonly heading: string;
  readonly lines: readonly string[];
};

export type PaletteResult = {
  readonly id: string;
  readonly providerId: PaletteProviderId;
  readonly title: string;
  readonly subtitle?: string;
  readonly keywords: readonly string[];
  readonly icon?: string;
  readonly shortcut?: string;
  readonly score: number;
  readonly group: string;
  readonly risky?: boolean;
  readonly disabledReason?: string;
  readonly detail?: PaletteResultDetail;
  readonly execute: () => Promise<void> | void;
};

export type ParsedPaletteQuery = {
  readonly raw: string;
  readonly prefix: PaletteQueryPrefix;
  readonly term: string;
};

export type PaletteProviderContext = {
  readonly now: () => number;
};

export type PaletteProvider = {
  readonly id: PaletteProviderId;
  readonly group: string;
  search(query: ParsedPaletteQuery, context: PaletteProviderContext): Promise<readonly PaletteResult[]>;
};
