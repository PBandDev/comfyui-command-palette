import { beforeEach, describe, expect, it } from "vitest";
import { BrowserUsageStore } from "../../src/palette/usage-store";

describe("BrowserUsageStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty metadata when storage is empty", () => {
    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("records node usage count and timestamp", () => {
    const store = new BrowserUsageStore("test-key");

    store.recordNodeUse("KSampler", 1234);

    expect(store.read().nodeUsage.KSampler).toEqual({ count: 1, lastUsedAt: 1234 });
  });

  it("records command usage count and timestamp", () => {
    const store = new BrowserUsageStore("test-key");

    store.recordCommandUse("search", 9876);

    expect(store.read().commandUsage.search).toEqual({ count: 1, lastUsedAt: 9876 });
  });

  it("recovers from invalid JSON", () => {
    localStorage.setItem("test-key", "{");
    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("returns empty metadata for an unsupported version", () => {
    localStorage.setItem(
      "test-key",
      JSON.stringify({
        version: 2,
        nodeUsage: {},
        commandUsage: {},
      }),
    );

    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("returns empty metadata when nodeUsage is missing", () => {
    localStorage.setItem(
      "test-key",
      JSON.stringify({
        version: 1,
        commandUsage: {},
      }),
    );

    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("returns empty metadata when commandUsage is missing", () => {
    localStorage.setItem(
      "test-key",
      JSON.stringify({
        version: 1,
        nodeUsage: {},
      }),
    );

    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("drops malformed usage maps and malformed entries", () => {
    localStorage.setItem(
      "test-key",
      JSON.stringify({
        version: 1,
        nodeUsage: {
          KSampler: { count: "1", lastUsedAt: 1234 },
          Loader: { count: 2, lastUsedAt: 5678 },
        },
        commandUsage: null,
      }),
    );

    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });

  it("filters invalid nested usage entries while keeping valid ones", () => {
    localStorage.setItem(
      "test-key",
      JSON.stringify({
        version: 1,
        nodeUsage: {
          KSampler: { count: 3, lastUsedAt: 1234 },
          Broken: { count: "nope", lastUsedAt: 5678 },
        },
        commandUsage: {
          search: { count: 1, lastUsedAt: 2345 },
          stale: { count: 2, lastUsedAt: null },
        },
      }),
    );

    const store = new BrowserUsageStore("test-key");

    expect(store.read()).toEqual({
      version: 1,
      nodeUsage: { KSampler: { count: 3, lastUsedAt: 1234 } },
      commandUsage: { search: { count: 1, lastUsedAt: 2345 } },
    });
  });

  it("returns fresh metadata on each read", () => {
    const store = new BrowserUsageStore("test-key");

    const first = store.read() as {
      readonly version: 1;
      readonly nodeUsage: Record<string, { count: number; lastUsedAt: number }>;
      readonly commandUsage: Record<string, { count: number; lastUsedAt: number }>;
    };

    first.nodeUsage.KSampler = { count: 99, lastUsedAt: 99 };

    expect(store.read()).toEqual({ version: 1, nodeUsage: {}, commandUsage: {} });
  });
});
