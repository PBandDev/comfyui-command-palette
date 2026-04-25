# Testing

## Commands

```bash
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm test:frontend
pnpm test:backend
pnpm setup:e2e
pnpm open:e2e
```

## Coverage

- `pnpm test` runs frontend unit tests, backend Python tests, and repo-local ComfyUI E2E.
- `pnpm test:unit` runs the fast frontend and backend test lanes only.
- `pnpm test:e2e` builds `dist/`, runs `pnpm setup:e2e`, starts scoped ComfyUI, and runs Playwright.
- `pnpm setup:e2e` provisions Chromium, browser OS dependencies, and ComfyUI under `.e2e/`.
- `pnpm open:e2e` builds `dist/`, provisions the same scoped ComfyUI install, and starts it for manual browser testing.

## E2E Harness

- ComfyUI defaults to `v0.18.1`; set `COMFYUI_E2E_REVISION` to test another tag.
- `comfy-cli` is pinned inside `.e2e/venv`.
- The ComfyUI checkout and Python runtime live under `.e2e/comfyui`.
- This repo is mounted into `.e2e/comfyui/custom_nodes/comfyui-command-palette`.
- `comfyui-node-organizer` is cloned from `https://github.com/PBandDev/comfyui-node-organizer`, pinned in `e2e.config.mjs`, built, and mounted into `.e2e/comfyui/custom_nodes/comfyui-node-organizer`.
- The harness is CPU-only so local and CI behavior are predictable.
- The default test server port is `8199`; set `COMFYUI_E2E_PORT` if that port is busy.
- Set `COMFYUI_E2E_WORKSPACE_SUFFIX` to isolate alternate installs under `.e2e/<suffix>/`.

If the pin changes or the scoped install gets stale, delete `.e2e/` and rerun `pnpm setup:e2e`.

## Compatibility Probes

Run revision-specific probes with a dedicated workspace suffix and port so installs do not reuse the default `.e2e/` workspace:

```powershell
$env:COMFYUI_E2E_REVISION='v0.18.1'
$env:COMFYUI_E2E_WORKSPACE_SUFFIX='compat-v0-18-1'
$env:COMFYUI_E2E_PORT='8293'
pnpm test:e2e
Remove-Item Env:\COMFYUI_E2E_REVISION -ErrorAction SilentlyContinue
Remove-Item Env:\COMFYUI_E2E_WORKSPACE_SUFFIX -ErrorAction SilentlyContinue
Remove-Item Env:\COMFYUI_E2E_PORT -ErrorAction SilentlyContinue
```

Use the oldest passing tested ComfyUI tag as `[tool.comfy].requires-comfyui` in `pyproject.toml`.

## Command Palette Verification

For command palette changes, run:

```bash
pnpm typecheck
pnpm test:frontend
pnpm test:e2e -- tests/e2e/command-palette.spec.ts
```

When changing ComfyUI adapter behavior, keep any browser/runtime investigation notes in local ignored docs.
