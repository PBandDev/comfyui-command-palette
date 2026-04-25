# ComfyUI Command Palette

A ComfyUI custom node pack that adds a frontend command palette for faster navigation and common actions.

## Features

- `Ctrl/Cmd+K`: open the palette through ComfyUI's keybinding system.
- `>`: run commands exposed by ComfyUI and installed frontend extensions.
- `@`: find and jump to nodes in the current graph.
- `+`: add installed nodes.
- `#`: open saved workflows and templates.
- `?`: open read-only help and about entries.

Settings add an adjustable node-jump zoom level and an option to hide API-only nodes from `+` search.

## Install

Clone this repository into your ComfyUI `custom_nodes` directory, then build the frontend assets:

```bash
pnpm install
pnpm build
```

Restart ComfyUI after installation.

## Development

```bash
pnpm install
uv sync --locked --group dev
pnpm typecheck
pnpm test:unit
```

Additional commands:

```bash
pnpm dev
pnpm test
pnpm test:e2e
pnpm open:e2e
```

`pnpm test:e2e` builds the frontend, provisions a scoped ComfyUI install, and runs the Playwright smoke suite.
`pnpm open:e2e` builds the frontend, provisions the same scoped ComfyUI install, and opens it for manual testing at `http://127.0.0.1:8199`.

## Docs

- [Testing](docs/TESTING.md)

## Publishing

Publishing uses the `Publish to Comfy registry` GitHub workflow. Add `REGISTRY_ACCESS_TOKEN` as a repository secret, then run the workflow from `main`.

## License

AGPL-3.0-only
