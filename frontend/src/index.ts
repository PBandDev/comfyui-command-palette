import type { ComfyApp } from "@comfyorg/comfyui-frontend-types";
import {
  COMMAND_IDS,
  COMMAND_PALETTE_REPO_URL,
  DEFAULT_NODE_JUMP_ZOOM,
  EXTENSION_NAME,
  SETTINGS_IDS,
} from "./constants";
import { createCommandPalette } from "./palette/create-palette";

declare global {
  const app: ComfyApp;

  interface Window {
    app: ComfyApp;
  }
}

let paletteHandle: ReturnType<typeof createCommandPalette> | null = null;

app.registerExtension({
  name: EXTENSION_NAME,
  commands: [
    {
      id: COMMAND_IDS.TOGGLE,
      label: "Command Palette",
      tooltip: "Open the ComfyUI command palette",
      function: () => {
        paletteHandle?.toggle();
      },
    },
  ],
  keybindings: [
    {
      commandId: COMMAND_IDS.TOGGLE,
      combo: {
        key: "k",
        ctrl: true,
      },
    },
  ],
  setup: (appInstance) => {
    paletteHandle?.destroy();
    paletteHandle = createCommandPalette(appInstance, document.body);
  },
  settings: [
    {
      id: SETTINGS_IDS.VERSION,
      name: "Version 1.0.1",
      type: () => {
        const spanEl = document.createElement("span");
        spanEl.insertAdjacentHTML(
          "beforeend",
          `<a href="${COMMAND_PALETTE_REPO_URL}" target="_blank" rel="noopener noreferrer" style="padding-right: 12px;">Homepage</a>`,
        );

        return spanEl;
      },
      defaultValue: undefined,
    },
    {
      id: SETTINGS_IDS.NODE_JUMP_ZOOM,
      name: "Node Jump Zoom",
      type: "slider",
      tooltip: "Zoom level used when jumping to nodes with @ search",
      attrs: { min: 0.35, max: 1.25, step: 0.05 },
      defaultValue: DEFAULT_NODE_JUMP_ZOOM,
    },
    {
      id: SETTINGS_IDS.HIDE_API_NODES,
      name: "Hide API Nodes",
      type: "boolean",
      tooltip: "Hide API-only nodes from + add-node search results",
      defaultValue: false,
    },
    {
      id: SETTINGS_IDS.DEBUG_LOGGING,
      name: "Enable Debug Logging",
      type: "boolean",
      tooltip: "Show detailed debug logs in browser console during operation",
      defaultValue: false,
    },
  ],
});
