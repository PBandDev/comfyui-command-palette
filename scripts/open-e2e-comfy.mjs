import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { e2eConfig } from "../e2e.config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const workspaceDir = resolve(projectRoot, e2eConfig.workspaceDir);
const comfyBinary =
  process.platform === "win32"
    ? resolve(projectRoot, e2eConfig.venvDir, "Scripts", "comfy.exe")
    : resolve(projectRoot, e2eConfig.venvDir, "bin", "comfy");
const comfyMain = resolve(projectRoot, e2eConfig.comfyDir, "main.py");

if (!existsSync(comfyBinary) || !existsSync(comfyMain)) {
  console.error("Missing repo-local ComfyUI E2E install. Run `pnpm setup:e2e` first.");
  process.exit(1);
}

console.log(`Starting E2E ComfyUI at ${e2eConfig.baseUrl}`);
console.log("Press Ctrl+C to stop it.");

const child = spawn(
  comfyBinary,
  [
    "--skip-prompt",
    `--workspace=${workspaceDir}`,
    "launch",
    "--",
    "--cpu",
    "--port",
    String(e2eConfig.port),
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
