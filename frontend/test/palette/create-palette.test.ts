import type { ComfyApp } from "@comfyorg/comfyui-frontend-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_IDS } from "../../src/constants";
import { createCommandPalette } from "../../src/palette/create-palette";

let handle: ReturnType<typeof createCommandPalette> | null = null;

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("createCommandPalette", () => {
  it("exposes a toggle handle so ComfyUI commands can open the palette", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        command: {
          commands: [{ id: "Comfy.SaveWorkflow" }],
          execute: () => undefined,
        },
      },
    });

    handle = createCommandPalette(app, host);

    handle.toggle();

    await vi.waitFor(() => {
      expect(host.querySelector('[data-command-palette="dialog"]')).not.toBeNull();
      expect(host.textContent).toContain("Save Workflow");
    });
  });

  it("does not install a local Ctrl+K shortcut listener", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        command: {
          commands: [{ id: "Comfy.SaveWorkflow" }],
          execute: () => undefined,
        },
      },
    });

    handle = createCommandPalette(app, host);

    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    }));

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(host.querySelector('[data-command-palette="dialog"]')).toBeNull();
  });

  it("executes the active result once from Enter and closes", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const execute = vi.fn();
    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        command: {
          commands: [{ id: "Comfy.SaveWorkflow" }],
          execute,
        },
      },
    });

    handle = createCommandPalette(app, host);

    handle.toggle();

    await vi.waitFor(() => {
      expect(host.textContent).toContain("Save Workflow");
    });

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    expect(input).not.toBeNull();
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-command-palette="dialog"]')).toBeNull();
    });
  });

  it("emits command palette diagnostics when debug logging is enabled", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);

    const execute = vi.fn();
    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        setting: {
          get: (settingId: string) => settingId === SETTINGS_IDS.DEBUG_LOGGING,
        },
        command: {
          commands: [{ id: "Comfy.SaveWorkflow" }],
          execute,
        },
      },
    });

    handle = createCommandPalette(app, host);

    handle.open();

    await vi.waitFor(() => {
      expect(host.textContent).toContain("Save Workflow");
    });

    expect(consoleLog).toHaveBeenCalledWith(
      "[ComfyUI Command Palette] palette opened",
      expect.objectContaining({ input: "" }),
    );
    expect(consoleLog).toHaveBeenCalledWith(
      "[ComfyUI Command Palette] palette results refreshed",
      expect.objectContaining({ resultCount: expect.any(Number) }),
    );

    consoleLog.mockRestore();
  });

  it("does not emit command palette diagnostics when debug logging is disabled", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);

    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        setting: {
          get: () => false,
        },
        command: {
          commands: [{ id: "Comfy.SaveWorkflow" }],
          execute: () => undefined,
        },
      },
    });

    handle = createCommandPalette(app, host);

    handle.open();

    await vi.waitFor(() => {
      expect(host.textContent).toContain("Save Workflow");
    });

    expect(consoleLog).not.toHaveBeenCalled();

    consoleLog.mockRestore();
  });

  it("closes the palette before executing commands that may open another dialog", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const closedBeforeExecute: boolean[] = [];
    const execute = vi.fn(() => {
      closedBeforeExecute.push(host.querySelector('[data-command-palette="dialog"]') === null);
    });
    const app: ComfyApp = Object.assign(Object.create(null), {
      extensionManager: {
        command: {
          commands: [{ id: "Workspace.CloseWorkflow", label: "Close Current Workflow" }],
          execute,
        },
      },
    });

    handle = createCommandPalette(app, host);

    handle.toggle();

    await vi.waitFor(() => {
      expect(host.textContent).toContain("Close Current Workflow");
    });

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    expect(input).not.toBeNull();
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(closedBeforeExecute).toEqual([true]);
    expect(host.querySelector('[data-command-palette="dialog"]')).toBeNull();
  });
});
