function readStringEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function safePathToken(value) {
  const token = value.replace(/[^a-zA-Z0-9_.-]/g, "-");
  if (token === "" || /^\.+$/.test(token)) {
    throw new Error(`COMFYUI_E2E_WORKSPACE_SUFFIX must resolve to a safe path token, got "${value}".`);
  }

  return token;
}

function readPort() {
  const rawPort = process.env.COMFYUI_E2E_PORT;
  if (rawPort === undefined || rawPort === "") {
    return 8199;
  }

  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`COMFYUI_E2E_PORT must be an integer from 1 to 65535, got "${rawPort}".`);
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`COMFYUI_E2E_PORT must be an integer from 1 to 65535, got "${rawPort}".`);
  }

  return port;
}

const comfyRevision = readStringEnv("COMFYUI_E2E_REVISION", "v0.18.1");
const workspaceSuffix = process.env.COMFYUI_E2E_WORKSPACE_SUFFIX;
const e2eRoot =
  workspaceSuffix === undefined || workspaceSuffix.trim() === ""
    ? ".e2e"
    : `.e2e/${safePathToken(workspaceSuffix)}`;
const port = readPort();

export const e2eConfig = {
  comfyRevision,
  comfyCliVersion: "1.7.2",
  port,
  workspaceDir: `${e2eRoot}/comfyui`,
  comfyDir: `${e2eRoot}/comfyui`,
  venvDir: `${e2eRoot}/venv`,
  nodeOrganizerRepo: "https://github.com/PBandDev/comfyui-node-organizer.git",
  nodeOrganizerRevision: "d0b18b147b3c576755e1cd7aca3204a85f312e2c",
  nodeOrganizerDir: `${e2eRoot}/node-organizer`,
  pidFile: `${e2eRoot}/comfy-${port}.pid`,
  logFile: `${e2eRoot}/comfy-${port}.log`,
  timeouts: {
    startupMs: 120_000,
    pageLoadMs: 30_000,
  },
  baseUrl: `http://127.0.0.1:${port}`,
};
