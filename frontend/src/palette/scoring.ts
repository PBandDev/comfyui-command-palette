import type { PaletteResult } from "./types";

const FILLER_QUERY_WORDS = new Set(["a", "an", "current", "of", "the", "to"]);

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function compact(value: string): string {
  return normalize(value).replace(/\s+/g, " ");
}

function words(value: string): readonly string[] {
  return compact(value).split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 0);
}

export function scoreTextMatch(title: string, keywords: readonly string[], query: string): number {
  const normalizedQuery = compact(query);

  if (normalizedQuery.length === 0) {
    return 1;
  }

  const normalizedTitle = compact(title);
  const normalizedKeywords = keywords.map(compact);

  if (normalizedTitle === normalizedQuery) {
    return 1000;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 800;
  }

  if (words(normalizedTitle).some((part) => part.startsWith(normalizedQuery))) {
    return 650;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 500;
  }

  if (normalizedKeywords.some((keyword) => keyword === normalizedQuery)) {
    return 450;
  }

  if (normalizedKeywords.some((keyword) => keyword.includes(normalizedQuery))) {
    return 300;
  }

  const queryWords = words(normalizedQuery).filter((word) => !FILLER_QUERY_WORDS.has(word));
  if (queryWords.length > 0) {
    const candidateWords = new Set([
      ...words(normalizedTitle),
      ...normalizedKeywords.flatMap((keyword) => words(keyword)),
    ]);

    if (queryWords.every((queryWord) => Array.from(candidateWords).some((candidate) => candidate.startsWith(queryWord)))) {
      return 250;
    }
  }

  return 0;
}

export function sortPaletteResults(results: readonly PaletteResult[]): readonly PaletteResult[] {
  return [...results].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftTitle = normalize(left.title);
    const rightTitle = normalize(right.title);

    if (leftTitle < rightTitle) {
      return -1;
    }

    if (leftTitle > rightTitle) {
      return 1;
    }

    return left.title < right.title ? -1 : left.title > right.title ? 1 : 0;
  });
}
