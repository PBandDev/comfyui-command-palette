import { describe, expect, it, vi } from "vitest";
import { ComfyAdapter } from "../../src/palette/comfy-adapter";
import { createCommandsProvider } from "../../src/palette/providers/commands";

describe("ComfyAdapter", () => {
  it("summarizes commands from an array-shaped command manager", () => {
    const adapter = new ComfyAdapter({
      extensionManager: {
        command: {
          commands: [
            {
              id: "Comfy.SaveWorkflow",
              label: "Save Workflow",
              tooltip: "Save the current workflow",
              source: "core",
              keybinding: { commandId: "Comfy.SaveWorkflow", combo: { key: "s", ctrl: true } },
            },
            { id: "Comfy.Canvas.FitView" },
          ],
          execute: () => undefined,
        },
      },
    });

    expect(adapter.listCommands()).toEqual([
      {
        commandId: "Comfy.SaveWorkflow",
        title: "Save Workflow",
        subtitle: "Comfy.SaveWorkflow",
        keywords: ["Comfy.SaveWorkflow", "Save Workflow", "Save the current workflow", "core"],
        shortcut: "Ctrl+S",
        risky: false,
      },
      {
        commandId: "Comfy.Canvas.FitView",
        title: "Fit View",
        subtitle: "Comfy.Canvas.FitView",
        keywords: ["Comfy.Canvas.FitView", "Fit View"],
        risky: false,
      },
    ]);
  });

  it("adds the humanized command id as a keyword when the runtime label is terse", () => {
    const adapter = new ComfyAdapter({
      extensionManager: {
        command: {
          commands: [{ id: "Workspace.CloseWorkflow", label: "Close" }],
          execute: () => undefined,
        },
      },
    });

    expect(adapter.listCommands()[0]?.keywords).toContain("Close Workflow");
  });
});

describe("createCommandsProvider", () => {
  it("lists matching commands discovered from ComfyUI", async () => {
    const executeCommand = vi.fn<(commandId: string) => void>();
    const provider = createCommandsProvider({
      listCommands: () => [
        {
          commandId: "Comfy.SaveWorkflow",
          title: "Save Workflow",
          subtitle: "Comfy.SaveWorkflow",
          keywords: ["Comfy.SaveWorkflow", "Save Workflow", "file"],
          shortcut: "Ctrl+S",
          risky: false,
        },
        {
          commandId: "node-organizer.organize-workflow",
          title: "Organize Workflow",
          subtitle: "node-organizer.organize-workflow",
          keywords: ["node-organizer.organize-workflow", "Organize Workflow"],
          shortcut: "Shift+O",
          risky: false,
        },
      ],
      executeCommand,
      recordCommandUse: () => undefined,
    });

    const results = await provider.search(
      { raw: "> organize", prefix: "commands", term: "organize" },
      { now: () => 100 },
    );

    expect(results.map((entry) => entry.id)).toEqual(["command:node-organizer.organize-workflow"]);
    expect(results[0]).toMatchObject({
      title: "Organize Workflow",
      subtitle: "node-organizer.organize-workflow",
      shortcut: "Shift+O",
    });
    await results[0]?.execute();
    expect(executeCommand).toHaveBeenCalledWith("node-organizer.organize-workflow");
  });

  it("records command use after a successful async execution", async () => {
    const events: string[] = [];
    const provider = createCommandsProvider({
      listCommands: () => [
        {
          commandId: "Comfy.SaveWorkflow",
          title: "Save Workflow",
          subtitle: "Comfy.SaveWorkflow",
          keywords: ["Comfy.SaveWorkflow", "Save Workflow"],
          risky: false,
        },
      ],
      executeCommand: async (commandId: string) => {
        events.push(`execute:${commandId}`);
      },
      recordCommandUse: (commandId: string, now: number) => {
        events.push(`record:${commandId}:${now}`);
      },
    });

    const results = await provider.search(
      { raw: "> save", prefix: "commands", term: "save" },
      { now: () => 123 },
    );

    await results[0]?.execute();

    expect(events).toEqual(["execute:Comfy.SaveWorkflow", "record:Comfy.SaveWorkflow:123"]);
  });

  it("does not record command use when execution rejects", async () => {
    const recordCommandUse = vi.fn<(commandId: string, now: number) => void>();
    const provider = createCommandsProvider({
      listCommands: () => [
        {
          commandId: "Comfy.SaveWorkflow",
          title: "Save Workflow",
          subtitle: "Comfy.SaveWorkflow",
          keywords: ["Comfy.SaveWorkflow", "Save Workflow"],
          risky: false,
        },
      ],
      executeCommand: async () => {
        throw new Error("boom");
      },
      recordCommandUse,
    });

    const results = await provider.search(
      { raw: "> save", prefix: "commands", term: "save" },
      { now: () => 123 },
    );

    await expect(results[0]?.execute()).rejects.toThrow("boom");
    expect(recordCommandUse).not.toHaveBeenCalled();
  });

  it("returns no commands when no discovered command matches", async () => {
    const provider = createCommandsProvider({
      listCommands: () => [
        {
          commandId: "Comfy.Canvas.FitView",
          title: "Fit View",
          subtitle: "Comfy.Canvas.FitView",
          keywords: ["Comfy.Canvas.FitView", "Fit View"],
          risky: false,
        },
      ],
      executeCommand: () => undefined,
      recordCommandUse: () => undefined,
    });

    const results = await provider.search(
      { raw: "> save", prefix: "commands", term: "save" },
      { now: () => 100 },
    );

    expect(results).toEqual([]);
  });
});
