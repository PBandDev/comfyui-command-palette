import { expect, test, type Page } from "@playwright/test";
import { e2eConfig } from "../../e2e.config.mjs";

const expectedComfyVersion = e2eConfig.comfyRevision.replace(/^v/, "");

type RuntimeCommand = {
  readonly id?: string;
  readonly label?: string;
};

type RuntimeCommandManager = {
  readonly commands?: readonly RuntimeCommand[] | Readonly<Record<string, object>>;
  execute?: (commandId: string) => void | Promise<void>;
};

type RuntimeGraphNode = {
  readonly id?: number | string;
  readonly type?: string;
  pos?: { 0: number; 1: number };
};

type RuntimeGraph = {
  readonly nodes?: RuntimeGraphNode[];
  add?: (node: RuntimeGraphNode) => void;
  remove?: (node: RuntimeGraphNode) => void;
};

type RuntimeCanvas = {
  readonly graph?: RuntimeGraph | null;
  readonly graph_mouse?: readonly [number, number];
  selectItems?: (nodes: RuntimeGraphNode[]) => void;
  animateToBounds?: (bounds: object, options: { readonly duration: number; readonly zoom: number }) => void;
};

type RuntimeApi = {
  readonly getNodeDefs?: () => Promise<object> | object;
  readonly getWorkflowTemplates?: () => Promise<Record<string, readonly string[]>> | Record<string, readonly string[]>;
  readonly getCoreWorkflowTemplates?:
    | (() => Promise<readonly RuntimeWorkflowTemplateCategory[]>)
    | (() => readonly RuntimeWorkflowTemplateCategory[]);
  readonly fetchApi?: (route: string) => Promise<Response> | Response;
};

type RuntimeWorkflowTemplateCategory = {
  readonly moduleName?: string;
  readonly templates?: readonly RuntimeWorkflowTemplateInfo[];
};

type RuntimeWorkflowTemplateInfo = {
  readonly name?: string;
};

type RuntimeApp = {
  readonly extensionManager?: {
    readonly command?: RuntimeCommandManager;
    readonly setting?: {
      get?: (settingId: string) => unknown;
    };
    readonly toast?: object;
    readonly dialog?: object;
  };
  readonly canvas?: RuntimeCanvas;
  readonly rootGraph?: RuntimeGraph | null;
  readonly api?: RuntimeApi;
  readonly loadGraphData?: (
    graphData: object,
    clean?: boolean,
    restoreView?: boolean,
    workflowName?: string,
    options?: { readonly openSource?: "template" | "file_button" | "file_drop" | "unknown" },
  ) => Promise<void> | void;
  readonly loadTemplateData?: (templateData: object) => void;
};

type RuntimeLiteGraph = {
  readonly createNode?: (nodeClass: string) => RuntimeGraphNode | null | undefined;
};

type RuntimeWindow = Window &
  typeof globalThis & {
    readonly app?: RuntimeApp;
    readonly LiteGraph?: RuntimeLiteGraph;
    __commandPaletteExecutedCommands?: string[];
    __commandPaletteDialogCommandFacts?: Array<{
      readonly commandId: string;
      readonly paletteOpenAtExecute: boolean;
    }>;
  };

async function openPalette(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return Boolean(runtime.app?.extensionManager?.command?.execute);
  });
  await expect(page.locator('[data-command-palette="styles"]')).toHaveCount(1);
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeVisible();
}

test("extension loads enough runtime for the command palette", async ({ page }) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return Boolean(runtime.app?.extensionManager?.command?.commands && runtime.app?.api?.getNodeDefs);
  });

  await expect(page.locator('[data-command-palette="styles"]')).toHaveCount(1);
});

test("shortcut opens a centered command palette dialog", async ({ page }) => {
  await openPalette(page);

  const dialog = page.getByRole("dialog", { name: "ComfyUI command palette" });
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (box !== null && viewport !== null) {
    const dialogCenterX = box.x + box.width / 2;
    const dialogCenterY = box.y + box.height / 2;
    expect(Math.abs(dialogCenterX - viewport.width / 2)).toBeLessThan(8);
    expect(Math.abs(dialogCenterY - viewport.height / 2)).toBeLessThan(8);
  }
});

test("typing a zoom command shows and can execute Zoom to Fit", async ({ page }) => {
  await openPalette(page);

  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("> zoom");

  const zoomToFit = page.locator('[data-command-palette-option-id="command:Comfy.Canvas.FitView"]');
  await expect(zoomToFit).toBeVisible();
  await expect(zoomToFit).toBeEnabled();

  await zoomToFit.click();

  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeHidden();
});

test("arrow navigation visibly moves the active palette result", async ({ page }) => {
  await openPalette(page);

  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("> zoom");
  const initialActive = page.locator('[data-command-palette-active="true"]');
  await expect(initialActive).toHaveCount(1);

  const initialOptionId = await initialActive.getAttribute("data-command-palette-option-id");
  await page.keyboard.press("ArrowDown");
  const nextActive = page.locator('[data-command-palette-active="true"]');
  await expect(nextActive).toHaveCount(1);

  await expect(nextActive).not.toHaveAttribute("data-command-palette-option-id", initialOptionId ?? "");
});

test("frontend-only note nodes appear in add-node search", async ({ page }) => {
  await openPalette(page);

  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("+ note");

  await expect(page.locator('[data-command-palette-option-id="add-node:Note"]')).toContainText("Note");
  await expect(page.locator('[data-command-palette-option-id="add-node:MarkdownNote"]')).toContainText(
    "Markdown Note",
  );
});

test("debug setting emits command palette console diagnostics", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "log" && message.text().includes("[ComfyUI Command Palette]")) {
      messages.push(message.text());
    }
  });

  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return Boolean(runtime.app?.extensionManager?.setting?.get && runtime.app.extensionManager.command?.execute);
  });

  await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const setting = runtime.app?.extensionManager?.setting;
    if (setting?.get === undefined) {
      throw new Error("Missing ComfyUI setting manager");
    }

    const originalGet = setting.get.bind(setting);
    setting.get = (settingId: string) => {
      if (settingId === "ComfyUI Command Palette.Debug Logging") {
        return true;
      }

      return originalGet(settingId);
    };
  });

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("> zoom");

  await expect.poll(() => messages).toEqual(
    expect.arrayContaining([
      expect.stringContaining("palette opened"),
      expect.stringContaining("palette results refreshed"),
    ]),
  );
});

test("node-organizer commands and default keybinding surface through ComfyUI commands", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return Boolean(runtime.app?.extensionManager?.command?.execute);
  });

  await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const command = runtime.app?.extensionManager?.command;
    if (command?.execute === undefined) {
      throw new Error("Missing ComfyUI command manager");
    }

    const originalExecute = command.execute.bind(command);
    runtime.__commandPaletteExecutedCommands = [];
    command.execute = async (commandId: string) => {
      runtime.__commandPaletteExecutedCommands?.push(commandId);
      await originalExecute(commandId);
    };
  });

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("> organize");

  await expect(page.locator('[data-command-palette-option-id="command:node-organizer.organize"]')).toContainText(
    "Shift+O",
  );
  await expect(
    page.locator('[data-command-palette-option-id="command:node-organizer.organize-workflow"]'),
  ).toContainText("Organize Workflow");
  await expect(
    page.locator('[data-command-palette-option-id="command:node-organizer.organize-groups"]'),
  ).toContainText("Organize Group");

  await page.locator('[data-command-palette-option-id="command:node-organizer.organize-workflow"]').click();

  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeHidden();
  await expect.poll(async () =>
    page.evaluate(() => {
      const runtime = window as RuntimeWindow;
      return runtime.__commandPaletteExecutedCommands ?? [];
    }),
  ).toContain("node-organizer.organize-workflow");
});

test("close workflow command can open a save dialog after the palette closes", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    const commands = runtime.app?.extensionManager?.command?.commands;
    const commandIds = Array.isArray(commands)
      ? commands.flatMap((command): readonly string[] => (typeof command.id === "string" ? [command.id] : []))
      : commands !== undefined
        ? Object.keys(commands)
        : [];
    return commandIds.includes("Workspace.CloseWorkflow") && runtime.app?.extensionManager?.command?.execute !== undefined;
  });

  await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const command = runtime.app?.extensionManager?.command;
    if (command?.execute === undefined) {
      throw new Error("Missing ComfyUI command manager");
    }

    const originalExecute = command.execute.bind(command);
    runtime.__commandPaletteDialogCommandFacts = [];
    command.execute = async (commandId: string) => {
      if (commandId === "Workspace.CloseWorkflow") {
        runtime.__commandPaletteDialogCommandFacts?.push({
          commandId,
          paletteOpenAtExecute: document.querySelector('[data-command-palette="dialog"]') !== null,
        });

        const dialog = document.createElement("div");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-label", "Save Changes?");
        dialog.textContent = "Save Changes?";
        document.body.append(dialog);
        return;
      }

      await originalExecute(commandId);
    };
  });

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search ComfyUI commands" }).fill("> close current workflow");

  const closeWorkflow = page.locator('[data-command-palette-option-id="command:Workspace.CloseWorkflow"]');
  await expect(closeWorkflow).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog", { name: "ComfyUI command palette" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Save Changes?" })).toBeVisible();
  await expect.poll(async () =>
    page.evaluate(() => {
      const runtime = window as RuntimeWindow;
      return runtime.__commandPaletteDialogCommandFacts ?? [];
    }),
  ).toEqual([{ commandId: "Workspace.CloseWorkflow", paletteOpenAtExecute: false }]);
});

test("/api/object_info fallback endpoint returns node definitions", async ({ request }) => {
  const response = await request.get("/api/object_info");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as Record<string, object>;
  expect(Object.keys(payload).length).toBeGreaterThan(0);
  expect(payload.KSampler).toBeDefined();
});

test("runtime APIs satisfy ComfyAdapter assumptions", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as RuntimeWindow;
    return Boolean(runtime.app?.canvas?.graph && runtime.app?.api?.getNodeDefs && runtime.LiteGraph?.createNode);
  });

  const facts = await page.evaluate(async () => {
    const runtime = window as RuntimeWindow;
    const app = runtime.app;
    const command = app?.extensionManager?.command;
    const rawCommands = command?.commands;
    const commandIds = Array.isArray(rawCommands)
      ? rawCommands.flatMap((entry): readonly string[] => (typeof entry.id === "string" ? [entry.id] : []))
      : rawCommands !== undefined
        ? Object.keys(rawCommands)
        : [];
    const canvas = app?.canvas;
    const graph = canvas?.graph ?? app?.rootGraph;
    const nodeDefs = await app?.api?.getNodeDefs?.();
    const nodeDefCount = nodeDefs !== undefined ? Object.keys(nodeDefs).length : 0;
    const testNodeClass = nodeDefCount > 0 ? (Object.keys(nodeDefs ?? {})[0] ?? "KSampler") : "KSampler";
    const beforeCount = graph?.nodes?.length ?? -1;
    let addProbe = { attempted: false, added: false, removed: false, nodeClass: testNodeClass };

    if (graph?.add !== undefined && graph.remove !== undefined && runtime.LiteGraph?.createNode !== undefined) {
      const node = runtime.LiteGraph.createNode(testNodeClass);
      addProbe = { ...addProbe, attempted: true };

      if (node !== null && node !== undefined) {
        if (node.pos === undefined) {
          node.pos = { 0: 240, 1: 260 };
        } else {
          node.pos[0] = 240;
          node.pos[1] = 260;
        }

        graph.add(node);
        const added = graph.nodes?.includes(node) === true;
        graph.remove(node);
        addProbe = {
          ...addProbe,
          added,
          removed: graph.nodes?.includes(node) === false,
        };
      }
    }

    const workflowResponse = await app?.api?.fetchApi?.("/userdata?dir=workflows&recurse=true&full_info=true");
    const workflowTemplatesResponse = await app?.api?.fetchApi?.("/workflow_templates");
    const apiWorkflowTemplatesResponse = await app?.api?.fetchApi?.("/api/workflow_templates");
    const coreTemplateCategories = (await app?.api?.getCoreWorkflowTemplates?.()) ?? [];
    const firstCoreTemplate = coreTemplateCategories
      .flatMap((category) => category.templates ?? [])
      .find((template) => typeof template.name === "string" && template.name.length > 0);
    const firstCoreTemplateRoute =
      firstCoreTemplate?.name !== undefined ? `/templates/${encodeURIComponent(firstCoreTemplate.name)}.json` : "";
    const firstCoreTemplateResponse =
      firstCoreTemplateRoute.length > 0 ? await fetch(firstCoreTemplateRoute) : undefined;
    const systemStatsResponse = await app?.api?.fetchApi?.("/system_stats");
    const systemStats = systemStatsResponse?.ok === true ? await systemStatsResponse.json() : {};
    const systemStatsObject = typeof systemStats === "object" && systemStats !== null ? systemStats : {};
    const systemObject =
      "system" in systemStatsObject && typeof systemStatsObject.system === "object" && systemStatsObject.system !== null
        ? systemStatsObject.system
        : {};

    return {
      commandManagerShape: Array.isArray(rawCommands) ? "array" : rawCommands !== undefined ? "object" : "missing",
      commandExecuteType: typeof command?.execute,
      commandIds,
      canvasGraphExists: graph !== undefined && graph !== null,
      graphNodesBeforeProbe: beforeCount,
      selectItemsType: typeof canvas?.selectItems,
      animateToBoundsType: typeof canvas?.animateToBounds,
      nodeDefCount,
      liteGraphCreateNodeType: typeof runtime.LiteGraph?.createNode,
      addProbe,
      loadGraphDataType: typeof app?.loadGraphData,
      loadTemplateDataType: typeof app?.loadTemplateData,
      getWorkflowTemplatesType: typeof app?.api?.getWorkflowTemplates,
      getCoreWorkflowTemplatesType: typeof app?.api?.getCoreWorkflowTemplates,
      workflowStatus: workflowResponse?.status ?? 0,
      workflowTemplatesStatus: workflowTemplatesResponse?.status ?? 0,
      apiWorkflowTemplatesStatus: apiWorkflowTemplatesResponse?.status ?? 0,
      coreTemplateCount: coreTemplateCategories.reduce(
        (count, category) => count + (category.templates?.length ?? 0),
        0,
      ),
      firstCoreTemplateRoute,
      firstCoreTemplateStatus: firstCoreTemplateResponse?.status ?? 0,
      comfyVersion:
        "comfyui_version" in systemObject && typeof systemObject.comfyui_version === "string"
          ? systemObject.comfyui_version
          : "",
      toastKeys: app?.extensionManager?.toast !== undefined ? Object.keys(app.extensionManager.toast) : [],
      dialogKeys: app?.extensionManager?.dialog !== undefined ? Object.keys(app.extensionManager.dialog) : [],
    };
  });

  expect(facts.comfyVersion).toBe(expectedComfyVersion);
  expect(facts.commandManagerShape).toBe("array");
  expect(facts.commandExecuteType).toBe("function");
  expect(facts.commandIds).toContain("Comfy.Canvas.FitView");
  expect(facts.commandIds).toContain("Comfy.RefreshNodeDefinitions");
  expect(facts.canvasGraphExists).toBe(true);
  expect(facts.graphNodesBeforeProbe).toBeGreaterThanOrEqual(0);
  expect(facts.selectItemsType).toBe("function");
  expect(facts.animateToBoundsType).toBe("function");
  expect(facts.nodeDefCount).toBeGreaterThan(0);
  expect(facts.liteGraphCreateNodeType).toBe("function");
  expect(facts.addProbe).toMatchObject({ attempted: true, added: true, removed: true });
  expect(facts.loadGraphDataType).toBe("function");
  expect(facts.loadTemplateDataType).toBe("function");
  expect(facts.getWorkflowTemplatesType).toBe("function");
  expect(facts.getCoreWorkflowTemplatesType).toBe("function");
  expect(facts.workflowStatus).toBeGreaterThan(0);
  expect(facts.workflowTemplatesStatus).toBe(200);
  expect(facts.apiWorkflowTemplatesStatus).toBe(404);
  expect(facts.coreTemplateCount).toBeGreaterThan(0);
  expect(facts.firstCoreTemplateRoute).toMatch(/^\/templates\/.+\.json$/);
  expect(facts.firstCoreTemplateStatus).toBe(200);
  expect(facts.toastKeys).toContain("add");
  expect(facts.dialogKeys).toContain("confirm");
});
