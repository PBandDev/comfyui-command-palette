import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { e2eConfig } from "../e2e.config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const workspaceDir = resolve(projectRoot, e2eConfig.workspaceDir);
const comfyDir = resolve(projectRoot, e2eConfig.comfyDir);
const workspaceVenvDir = resolve(projectRoot, e2eConfig.venvDir);
const customNodesDir = resolve(comfyDir, "custom_nodes");
const comfyRevisionPath = resolve(comfyDir, ".e2e-comfy-revision");
const nodeOrganizerDir = resolve(projectRoot, e2eConfig.nodeOrganizerDir);
const nodeOrganizerDistPath = resolve(nodeOrganizerDir, "dist", "index.js");
const nodeOrganizerRevisionPath = resolve(nodeOrganizerDir, ".e2e-built-revision");
const packageJsonPath = resolve(projectRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const mountedNodeDir = resolve(customNodesDir, packageJson.name);
const mountedNodeOrganizerDir = resolve(customNodesDir, "comfyui-node-organizer");
const pythonBinary =
  process.platform === "win32"
    ? resolve(workspaceVenvDir, "Scripts", "python.exe")
    : resolve(workspaceVenvDir, "bin", "python");
const comfyBinary =
  process.platform === "win32"
    ? resolve(workspaceVenvDir, "Scripts", "comfy.exe")
    : resolve(workspaceVenvDir, "bin", "comfy");

function run(command, args, label, options = {}) {
  console.log(`[setup:e2e] ${label}`);
  console.log(`[setup:e2e] $ ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    shell: options.shell ?? false,
    stdio: "inherit",
  });
}

function ensureWorkspaceVenv() {
  if (existsSync(pythonBinary)) {
    return;
  }

  mkdirSync(resolve(projectRoot, e2eConfig.workspaceDir, ".."), { recursive: true });
  run("uv", ["venv", workspaceVenvDir], "Create repo-local E2E virtual environment");
}

function ensureComfyCli() {
  if (existsSync(comfyBinary)) {
    return;
  }

  run(
    "uv",
    [
      "pip",
      "install",
      "--python",
      pythonBinary,
      `comfy-cli==${e2eConfig.comfyCliVersion}`,
    ],
    "Install comfy-cli into the E2E virtual environment",
  );
}

function resetRevisionMismatch() {
  const mainPyPath = resolve(comfyDir, "main.py");
  if (!existsSync(mainPyPath)) {
    return;
  }

  const currentRevision = existsSync(comfyRevisionPath)
    ? readFileSync(comfyRevisionPath, "utf8").trim()
    : "";

  if (currentRevision === e2eConfig.comfyRevision) {
    return;
  }

  rmSync(comfyDir, { recursive: true, force: true });
  rmSync(workspaceVenvDir, { recursive: true, force: true });
}

function ensurePinnedComfyInstall() {
  const mainPyPath = resolve(comfyDir, "main.py");
  if (existsSync(mainPyPath)) {
    return;
  }

  mkdirSync(dirname(comfyDir), { recursive: true });
  run(
    comfyBinary,
    [
      "--skip-prompt",
      `--workspace=${workspaceDir}`,
      "install",
      "--skip-manager",
      "--fast-deps",
      "--cpu",
      "--url",
      `https://github.com/comfyanonymous/ComfyUI.git@${e2eConfig.comfyRevision}`,
    ],
    "Install pinned ComfyUI workspace",
    { cwd: dirname(comfyDir) },
  );
  writeFileSync(comfyRevisionPath, e2eConfig.comfyRevision, "utf8");
}

function ensureMountedCustomNode() {
  mkdirSync(customNodesDir, { recursive: true });

  if (!existsSync(mountedNodeDir)) {
    symlinkSync(projectRoot, mountedNodeDir, process.platform === "win32" ? "junction" : "dir");
    return;
  }

  try {
    const stats = lstatSync(mountedNodeDir);
    if (!stats.isSymbolicLink()) {
      throw new Error("Mounted custom node path already exists and is not a symlink");
    }

    const currentTarget = resolve(customNodesDir, readlinkSync(mountedNodeDir));
    if (currentTarget !== projectRoot) {
      rmSync(mountedNodeDir, { recursive: true, force: true });
      symlinkSync(projectRoot, mountedNodeDir, process.platform === "win32" ? "junction" : "dir");
    }
  } catch (error) {
    rmSync(mountedNodeDir, { recursive: true, force: true });
    symlinkSync(projectRoot, mountedNodeDir, process.platform === "win32" ? "junction" : "dir");
  }
}

function ensurePinnedNodeOrganizerSource() {
  if (!existsSync(resolve(nodeOrganizerDir, ".git"))) {
    if (existsSync(nodeOrganizerDir)) {
      rmSync(nodeOrganizerDir, { recursive: true, force: true });
    }

    mkdirSync(dirname(nodeOrganizerDir), { recursive: true });
    run(
      "git",
      ["clone", "--filter=blob:none", e2eConfig.nodeOrganizerRepo, nodeOrganizerDir],
      "Clone node-organizer E2E custom node",
    );
  }

  run(
    "git",
    ["fetch", "--depth=1", "origin", e2eConfig.nodeOrganizerRevision],
    "Fetch pinned node-organizer revision",
    { cwd: nodeOrganizerDir },
  );
  run(
    "git",
    ["checkout", "--force", e2eConfig.nodeOrganizerRevision],
    "Checkout pinned node-organizer revision",
    { cwd: nodeOrganizerDir },
  );
}

function ensureNodeOrganizerBuilt() {
  const currentBuiltRevision = existsSync(nodeOrganizerRevisionPath)
    ? readFileSync(nodeOrganizerRevisionPath, "utf8").trim()
    : "";

  if (existsSync(nodeOrganizerDistPath) && currentBuiltRevision === e2eConfig.nodeOrganizerRevision) {
    return;
  }

  run("pnpm", ["install", "--frozen-lockfile"], "Install node-organizer frontend dependencies", {
    cwd: nodeOrganizerDir,
    shell: process.platform === "win32",
  });
  run("pnpm", ["build"], "Build node-organizer frontend assets", {
    cwd: nodeOrganizerDir,
    shell: process.platform === "win32",
  });
  writeFileSync(nodeOrganizerRevisionPath, e2eConfig.nodeOrganizerRevision, "utf8");
}

function ensureMountedNodeOrganizer() {
  mkdirSync(customNodesDir, { recursive: true });

  if (!existsSync(mountedNodeOrganizerDir)) {
    symlinkSync(nodeOrganizerDir, mountedNodeOrganizerDir, process.platform === "win32" ? "junction" : "dir");
    return;
  }

  try {
    const stats = lstatSync(mountedNodeOrganizerDir);
    if (!stats.isSymbolicLink()) {
      throw new Error("Mounted node-organizer path already exists and is not a symlink");
    }

    const currentTarget = resolve(customNodesDir, readlinkSync(mountedNodeOrganizerDir));
    if (currentTarget !== nodeOrganizerDir) {
      rmSync(mountedNodeOrganizerDir, { recursive: true, force: true });
      symlinkSync(nodeOrganizerDir, mountedNodeOrganizerDir, process.platform === "win32" ? "junction" : "dir");
    }
  } catch {
    rmSync(mountedNodeOrganizerDir, { recursive: true, force: true });
    symlinkSync(nodeOrganizerDir, mountedNodeOrganizerDir, process.platform === "win32" ? "junction" : "dir");
  }
}

resetRevisionMismatch();
ensureWorkspaceVenv();
ensureComfyCli();
ensurePinnedComfyInstall();
ensureMountedCustomNode();
ensurePinnedNodeOrganizerSource();
ensureNodeOrganizerBuilt();
ensureMountedNodeOrganizer();
