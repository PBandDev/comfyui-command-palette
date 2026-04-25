import type { PaletteQueryPrefix, ParsedPaletteQuery } from "./types";

const PREFIX_MAP = new Map<string, PaletteQueryPrefix>([
  [">", "commands"],
  ["@", "graphNodes"],
  ["+", "addNodes"],
  ["#", "workflows"],
  ["?", "help"],
]);

export function parsePaletteQuery(input: string): ParsedPaletteQuery {
  const raw = input;
  const trimmed = input.trimStart();
  const first = trimmed[0];

  if (first === undefined) {
    return { raw, prefix: "all", term: "" };
  }

  const prefix = PREFIX_MAP.get(first);

  if (prefix === undefined) {
    return { raw, prefix: "all", term: trimmed };
  }

  return {
    raw,
    prefix,
    term: trimmed.slice(1).trimStart(),
  };
}
