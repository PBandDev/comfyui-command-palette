# ComfyUI Compatibility Probes - 2026-04-24

E2E compatibility was probed with isolated ComfyUI workspaces by setting `COMFYUI_E2E_REVISION`, `COMFYUI_E2E_WORKSPACE_SUFFIX`, and `COMFYUI_E2E_PORT` before `pnpm test:e2e`.

| Revision | Port | Command summary | Result | Notes |
| --- | ---: | --- | --- | --- |
| `v0.3.0` | 8290 | `COMFYUI_E2E_REVISION=v0.3.0`, `COMFYUI_E2E_WORKSPACE_SUFFIX=compat-v0-3-0`, `COMFYUI_E2E_PORT=8290`, `pnpm test:e2e` | FAIL | Did not become ready within configured startup timeout (`120000ms`). ComfyUI log shows `ModuleNotFoundError: No module named 'requests'`. Installed tag verified as `v0.3.0` (`22535d05`). |
| `v0.10.0` | 8291 | `COMFYUI_E2E_REVISION=v0.10.0`, `COMFYUI_E2E_WORKSPACE_SUFFIX=compat-v0-10-0`, `COMFYUI_E2E_PORT=8291`, `pnpm test:e2e` | FAIL | Did not become ready within configured startup timeout (`120000ms`). ComfyUI log shows `ModuleNotFoundError: No module named 'requests'`. Installed tag verified as `v0.10.0` (`9d273d3a`). |
| `v0.14.0` | 8292 | `COMFYUI_E2E_REVISION=v0.14.0`, `COMFYUI_E2E_WORKSPACE_SUFFIX=compat-v0-14-0`, `COMFYUI_E2E_PORT=8292`, `pnpm test:e2e` | PASS | `13 passed`, including the final debug diagnostics E2E test, after deriving the expected runtime version from `COMFYUI_E2E_REVISION`. Installed tag verified as `v0.14.0` (`fe52843f`). |
| `v0.18.1` | 8293 | `COMFYUI_E2E_REVISION=v0.18.1`, `COMFYUI_E2E_WORKSPACE_SUFFIX=compat-v0-18-1`, `COMFYUI_E2E_PORT=8293`, `pnpm test:e2e` | PASS | `12 passed`. Installed tag verified as `v0.18.1` (`ebf6b52e`). |

Oldest passing tested revision: `v0.14.0`.

Registry metadata chosen: `[tool.comfy].requires-comfyui = ">=0.14.0"`.
