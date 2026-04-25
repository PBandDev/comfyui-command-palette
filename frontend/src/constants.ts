export const EXTENSION_NAME = "ComfyUI Command Palette";
export const SETTINGS_PREFIX = EXTENSION_NAME;
export const LOGGING_PREFIX = `[${SETTINGS_PREFIX}]`;

export const SETTINGS_IDS = {
  VERSION: `${SETTINGS_PREFIX}.Version`,
  DEBUG_LOGGING: `${SETTINGS_PREFIX}.Debug Logging`,
  NODE_JUMP_ZOOM: `${SETTINGS_PREFIX}.Node Jump Zoom`,
  HIDE_API_NODES: `${SETTINGS_PREFIX}.Hide API Nodes`,
} as const;

export const COMMAND_IDS = {
  TOGGLE: "Comfy.CommandPalette.Toggle",
} as const;

export const DEFAULT_NODE_JUMP_ZOOM = 0.75;
export const COMMAND_PALETTE_REPO_URL = "https://github.com/PBandDev/comfyui-command-palette";
