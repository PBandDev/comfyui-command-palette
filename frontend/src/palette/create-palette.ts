import type { ComfyApp } from "@comfyorg/comfyui-frontend-types";
import { DEFAULT_NODE_JUMP_ZOOM, SETTINGS_IDS } from "../constants";
import { debugLog } from "../debug";
import { BrowserUsageStore } from "./usage-store";
import { ComfyAdapter, type ComfyAppLike } from "./comfy-adapter";
import { PaletteController } from "./controller";
import { ProviderRegistry } from "./provider-registry";
import { PaletteRenderer } from "./renderer";
import { createAddNodesProvider } from "./providers/add-nodes";
import { createCommandsProvider } from "./providers/commands";
import { createGraphNodesProvider } from "./providers/graph-nodes";
import { createHelpProvider } from "./providers/help";
import { createWorkflowsProvider } from "./providers/workflows";
import type { PaletteProviderContext, PaletteResult } from "./types";

type CommandPaletteHandle = {
  readonly open: () => void;
  readonly close: () => void;
  readonly toggle: () => void;
  readonly destroy: () => void;
};

export function createCommandPalette(app: ComfyApp, host: HTMLElement): CommandPaletteHandle {
  const adapter = new ComfyAdapter(app as ComfyAppLike);
  const usageStore = new BrowserUsageStore("comfyui-command-palette/usage");
  const readDebugSetting = (settingId: string): boolean => adapter.readSettingBoolean(settingId, false);

  const context: PaletteProviderContext = {
    now: () => Date.now(),
  };

  const registry = new ProviderRegistry([
    createCommandsProvider({
      listCommands: () => adapter.listCommands(),
      executeCommand: async (commandId) => {
        await adapter.executeCommand(commandId);
      },
      recordCommandUse: (commandId, now) => {
        usageStore.recordCommandUse(commandId, now);
      },
    }),
    createGraphNodesProvider({
      listActiveGraphNodes: () => adapter.listActiveGraphNodes(),
      selectAndFrameNode: (nodeId, options) => {
        adapter.selectAndFrameNode(nodeId, options);
      },
      readNodeJumpZoom: () => {
        return adapter.readSettingNumber(SETTINGS_IDS.NODE_JUMP_ZOOM, DEFAULT_NODE_JUMP_ZOOM);
      },
    }),
    createAddNodesProvider({
      listNodeDefinitions: () => adapter.listNodeDefinitions(),
      startNativeAddNode: async (nodeClass) => {
        await adapter.startNativeAddNode(nodeClass);
      },
      isAddNodeAvailable: () => adapter.canStartNativeAddNode(),
      readHideApiNodes: () => adapter.readSettingBoolean(SETTINGS_IDS.HIDE_API_NODES, false),
      readUsage: () => usageStore.read(),
      recordNodeUse: (nodeClass, now) => {
        usageStore.recordNodeUse(nodeClass, now);
      },
    }),
    createWorkflowsProvider({
      listWorkflowEntries: () => adapter.listWorkflowEntries(),
      loadWorkflow: async (path) => {
        await adapter.loadWorkflow(path);
      },
      loadTemplate: async (path) => {
        await adapter.loadTemplate(path);
      },
    }),
    createHelpProvider({
      openUrl: (url) => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      version: "1.0.0",
    }),
  ]);

  const controller = new PaletteController();
  const renderer = new PaletteRenderer(host, {
    onInput: (value) => controller.setInput(value),
    onClose: () => {
      controller.close();
      renderer.render(controller.getState());
    },
    onExecute: async (result) => {
      await closeAndExecute(result);
    },
    onNavigateDown: () => {
      controller.navigateDown();
      renderer.render(controller.getState());
    },
    onNavigateUp: () => {
      controller.navigateUp();
      renderer.render(controller.getState());
    },
  });

  let searchSeq = 0;
  let destroyed = false;

  const refreshResults = async (): Promise<void> => {
    const token = ++searchSeq;
    const state = controller.getState();

    if (!state.open) {
      return;
    }

    debugLog(readDebugSetting, "palette search requested", { input: state.input });
    const results = await registry.search(state.input, context);

    // Guard against stale async searches and against teardown.
    if (destroyed || token !== searchSeq || !controller.getState().open) {
      return;
    }

    controller.registerResults(results);
    renderer.render(controller.getState());
    debugLog(readDebugSetting, "palette results refreshed", { input: state.input, resultCount: results.length });
  };

  const closeAndExecute = async (result: PaletteResult): Promise<void> => {
    controller.close();
    renderer.render(controller.getState());
    debugLog(readDebugSetting, "palette result executing", {
      id: result.id,
      providerId: result.providerId,
      title: result.title,
    });
    await result.execute();
  };

  const unsubChange = controller.onChange(() => {
    void refreshResults();
    renderer.render(controller.getState());
  });

  const unsubSelect = controller.onSelect(async (result) => {
    await closeAndExecute(result);
  });

  const open = (): void => {
    controller.open();
    debugLog(readDebugSetting, "palette opened", { input: controller.getState().input });
    renderer.render(controller.getState());
    void refreshResults();
  };

  const close = (): void => {
    controller.close();
    debugLog(readDebugSetting, "palette closed", { input: controller.getState().input });
    renderer.render(controller.getState());
  };

  const toggle = (): void => {
    controller.toggle();
    const state = controller.getState();
    debugLog(readDebugSetting, "palette toggled", { open: state.open, input: state.input });
    debugLog(readDebugSetting, state.open ? "palette opened" : "palette closed", { input: state.input });
    renderer.render(controller.getState());
    void refreshResults();
  };

  renderer.render(controller.getState());

  return {
    open,
    close,
    toggle,
    destroy: () => {
      destroyed = true;
      unsubChange();
      unsubSelect();
      renderer.destroy();
      controller.destroy();
    },
  };
}
