export type UsageEntry = {
  readonly count: number;
  readonly lastUsedAt: number;
};

export type UsageMetadata = {
  readonly version: 1;
  readonly nodeUsage: Readonly<Record<string, UsageEntry>>;
  readonly commandUsage: Readonly<Record<string, UsageEntry>>;
};

type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

type JsonObject = {
  readonly [key: string]: JsonValue;
};

function createEmptyUsageMetadata(): UsageMetadata {
  return {
    version: 1,
    nodeUsage: {},
    commandUsage: {},
  };
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: JsonValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeUsageMap(value: JsonValue): Readonly<Record<string, UsageEntry>> | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const normalized: Record<string, UsageEntry> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (!isJsonObject(entryValue)) {
      continue;
    }

    const { count, lastUsedAt } = entryValue;

    if (!isFiniteNumber(count) || !isFiniteNumber(lastUsedAt)) {
      continue;
    }

    normalized[entryKey] = {
      count,
      lastUsedAt,
    };
  }

  return normalized;
}

export class BrowserUsageStore {
  constructor(private readonly storageKey: string) {}

  read(): UsageMetadata {
    const raw = localStorage.getItem(this.storageKey);

    if (raw === null) {
      return createEmptyUsageMetadata();
    }

    try {
      const parsed = JSON.parse(raw) as JsonValue;

      if (!isJsonObject(parsed) || parsed.version !== 1) {
        return createEmptyUsageMetadata();
      }

      const nodeUsage = normalizeUsageMap(parsed.nodeUsage);
      const commandUsage = normalizeUsageMap(parsed.commandUsage);

      if (nodeUsage === null || commandUsage === null) {
        return createEmptyUsageMetadata();
      }

      return {
        version: 1,
        nodeUsage,
        commandUsage,
      };
    } catch {
      return createEmptyUsageMetadata();
    }
  }

  recordNodeUse(nodeClass: string, now: number): void {
    const current = this.read();
    const previous = current.nodeUsage[nodeClass] ?? { count: 0, lastUsedAt: 0 };

    this.write({
      ...current,
      nodeUsage: {
        ...current.nodeUsage,
        [nodeClass]: { count: previous.count + 1, lastUsedAt: now },
      },
    });
  }

  recordCommandUse(commandId: string, now: number): void {
    const current = this.read();
    const previous = current.commandUsage[commandId] ?? { count: 0, lastUsedAt: 0 };

    this.write({
      ...current,
      commandUsage: {
        ...current.commandUsage,
        [commandId]: { count: previous.count + 1, lastUsedAt: now },
      },
    });
  }

  write(metadata: UsageMetadata): void {
    localStorage.setItem(this.storageKey, JSON.stringify(metadata));
  }
}
