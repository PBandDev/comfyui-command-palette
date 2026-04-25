type StringFactory = () => string;

type CommandLike = {
  readonly id: string;
  readonly label?: string | StringFactory;
  readonly menubarLabel?: string | StringFactory;
  readonly tooltip?: string | StringFactory;
  readonly confirmation?: string;
  readonly source?: string;
  readonly category?: string;
  readonly keybinding?: KeybindingLike;
};

type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

type JsonObject = {
  readonly [key: string]: JsonValue;
};

type WorkflowTemplateMap = Readonly<Record<string, readonly string[]>>;

type CoreWorkflowTemplateCategory = {
  readonly moduleName?: string;
  readonly title?: string;
  readonly templates?: readonly CoreWorkflowTemplate[];
};

type CoreWorkflowTemplate = {
  readonly name?: string;
  readonly id?: string;
  readonly title?: string;
  readonly localizedTitle?: string;
};

type WorkflowOpenSource = "file_button" | "file_drop" | "template" | "unknown";

type LoadGraphOptions = {
  readonly openSource?: WorkflowOpenSource;
};

type LoadGraphData = (
  graphData?: JsonObject,
  clean?: boolean,
  restoreView?: boolean,
  workflow?: string | null,
  options?: LoadGraphOptions,
) => Promise<void> | void;

type RouteSource = "api" | "static";

type RouteCandidate = {
  readonly route: string;
  readonly source: RouteSource;
};

type LiteGraphBoundsLike = object & {
  readonly 0?: number;
  readonly 1?: number;
  readonly 2?: number;
  readonly 3?: number;
};
type LiteGraphNodeIdLike = number | string;
type LiteGraphPositionLike = {
  0: number;
  1: number;
};
type LiteGraphViewportLike = {
  readonly visible_area?: LiteGraphBoundsLike;
};
type LiteGraphCreatedNodeLike = LiteGraphNodeLike & {
  pos?: LiteGraphPositionLike;
};
type LiteGraphGlobalLike = {
  readonly createNode?: (nodeClass: string) => LiteGraphCreatedNodeLike | null | undefined;
  readonly registered_node_types?: Readonly<Record<string, LiteGraphRegisteredNodeLike>>;
};
type LiteGraphRegisteredNodeLike = {
  readonly title?: string;
  readonly name?: string;
  readonly type?: string;
  readonly category?: string;
  readonly comfyClass?: string;
  readonly prototype?: {
    readonly title?: string;
    readonly type?: string;
  };
};
type SelectAndFrameNodeOptions = {
  readonly zoom: number;
};
type KeybindingComboLike = {
  readonly key?: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
  readonly getKeySequences?: () => readonly string[];
};
type KeybindingLike = {
  readonly commandId?: string;
  readonly combo?: KeybindingComboLike;
};
type KeybindingRegistryLike = {
  readonly keybindings?: readonly KeybindingLike[] | Readonly<Record<string, KeybindingLike>>;
  readonly bindings?: readonly KeybindingLike[] | Readonly<Record<string, KeybindingLike>>;
  readonly getKeybindingByCommandId?: (commandId: string) => KeybindingLike | undefined;
};
type SettingsLike = {
  readonly get?: (id: string) => JsonValue | undefined;
};

declare global {
  var LiteGraph: LiteGraphGlobalLike | undefined;
}

export type NodeDefinitionSummary = {
  readonly nodeClass: string;
  readonly displayName: string;
  readonly category: string;
  readonly description: string;
  readonly isApiNode?: boolean;
};

export type CommandSummary = {
  readonly commandId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly keywords: readonly string[];
  readonly shortcut?: string;
  readonly risky: boolean;
};

export type ActiveGraphNode = {
  readonly id: number;
  readonly title: string;
  readonly type: string;
  readonly nodeClass: string;
};

export type WorkflowEntry = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly kind: "workflow" | "template";
  readonly path: string;
};

export type LiteGraphNodeLike = {
  readonly id: LiteGraphNodeIdLike;
  readonly title?: string | null;
  readonly type?: string | null;
  readonly comfyClass?: string | null;
  readonly nodeClass?: string | null;
  readonly boundingRect?: LiteGraphBoundsLike;
};

export type LiteGraphLike = {
  readonly nodes?: readonly LiteGraphNodeLike[];
  readonly add?: object;
};

export type CanvasLike = {
  readonly graph?: LiteGraphLike | null;
  readonly ds?: LiteGraphViewportLike;
  readonly graph_mouse?: LiteGraphPositionLike;
  selectItems?(nodes: LiteGraphNodeLike[]): void;
  animateToBounds?(bounds: LiteGraphBoundsLike, options: { readonly duration: number; readonly zoom: number }): void;
  setDirty?(foreground: boolean, background: boolean): void;
};

export type CommandManagerLike = {
  readonly commands?: readonly CommandLike[] | Readonly<Record<string, CommandLike | object>>;
  execute?: (commandId: string) => void | Promise<void>;
};

export type ExtensionManagerLike = {
  readonly command?: CommandManagerLike;
  readonly keybinding?: KeybindingRegistryLike;
  readonly keybindings?: KeybindingRegistryLike;
  readonly keybindingStore?: KeybindingRegistryLike;
  readonly setting?: SettingsLike;
};

export type ApiLike = {
  readonly getNodeDefs?: () => Promise<JsonValue> | JsonValue;
  readonly getWorkflowTemplates?: () => Promise<WorkflowTemplateMap> | WorkflowTemplateMap;
  readonly getCoreWorkflowTemplates?: (locale?: string) =>
    | Promise<readonly CoreWorkflowTemplateCategory[]>
    | readonly CoreWorkflowTemplateCategory[];
  readonly fetchApi?: (route: string) => Promise<Response> | Response;
  readonly fileURL?: (route: string) => string;
};

export type ComfyAppLike = {
  readonly extensionManager?: ExtensionManagerLike;
  readonly canvas?: CanvasLike;
  readonly rootGraph?: LiteGraphLike | null;
  readonly api?: ApiLike;
  readonly loadGraphData?: LoadGraphData;
};

export class ComfyAdapter {
  constructor(private readonly app: ComfyAppLike) {}

  listCommands(): readonly CommandSummary[] {
    const shortcuts = this.readCommandShortcuts();
    return this.commandEntries().map((command) => {
      const commandTitle = commandIdToTitle(command.id);
      const title = readStringValue(command.label) ?? readStringValue(command.menubarLabel) ?? commandTitle;
      const tooltip = readStringValue(command.tooltip);
      const menubarLabel = readStringValue(command.menubarLabel);

      return {
        commandId: command.id,
        title,
        subtitle: command.id,
        keywords: uniqueStrings([command.id, title, commandTitle, menubarLabel, tooltip, command.source, command.category]),
        shortcut: shortcuts.get(command.id),
        risky: command.confirmation !== undefined,
      };
    });
  }

  listAvailableCommandIds(): ReadonlySet<string> {
    return new Set(this.commandEntries().map((command) => command.id));
  }

  private commandEntries(): readonly CommandLike[] {
    const commands = this.app.extensionManager?.command?.commands;

    if (commands === undefined) {
      return [];
    }

    if (Array.isArray(commands)) {
      return commands;
    }

    return Object.entries(commands).map(([commandId, command]) => commandWithId(commandId, command));
  }

  async executeCommand(commandId: string): Promise<void> {
    const commandManager = this.app.extensionManager?.command;

    if (commandManager?.execute === undefined) {
      throw new Error(`ComfyUI command manager is unavailable: ${commandId}`);
    }

    await commandManager.execute(commandId);
  }

  async listNodeDefinitions(): Promise<readonly NodeDefinitionSummary[]> {
    const definitions = await this.readNodeDefinitionPayload();
    const entries = Object.entries(definitions).map(([nodeClass, definition]) =>
      nodeDefinitionFromPayload(nodeClass, definition),
    );
    const seen = new Set(entries.map((entry) => entry.nodeClass));

    const frontendEntries = this.readFrontendNodeDefinitions().filter((entry) => !seen.has(entry.nodeClass));

    return [...entries, ...frontendEntries];
  }

  async startNativeAddNode(nodeClass: string): Promise<void> {
    const graph = this.activeGraph();

    if (graph === undefined) {
      throw new Error(`Cannot add node because active graph is unavailable: ${nodeClass}`);
    }

    const addNode = readGraphAdd(graph);

    if (addNode === undefined) {
      throw new Error(`Cannot add node because active graph add() is unavailable: ${nodeClass}`);
    }

    const liteGraph = globalThis.LiteGraph;

    if (liteGraph?.createNode === undefined) {
      throw new Error(`Cannot add node because LiteGraph.createNode is unavailable: ${nodeClass}`);
    }

    const node = liteGraph.createNode(nodeClass);

    if (node === null || node === undefined) {
      throw new Error(`Cannot add node because LiteGraph.createNode returned no node: ${nodeClass}`);
    }

    this.placeNodeAtViewportCenter(node);
    addNode.call(graph, node);
    this.app.canvas?.selectItems?.([node]);
    this.app.canvas?.setDirty?.(true, true);
  }

  canStartNativeAddNode(): boolean {
    return readGraphAdd(this.activeGraph()) !== undefined && globalThis.LiteGraph?.createNode !== undefined;
  }

  listActiveGraphNodes(): readonly ActiveGraphNode[] {
    return this.activeGraphNodes().map((node) => {
      const type = node.type ?? "";
      const nodeClass = node.nodeClass ?? node.comfyClass ?? type;

      return {
        id: Number(node.id),
        title: node.title ?? String(node.id),
        type,
        nodeClass,
      };
    });
  }

  selectAndFrameNode(nodeId: number, options: SelectAndFrameNodeOptions): void {
    const node = this.activeGraphNodes().find((entry) => String(entry.id) === String(nodeId));

    if (node === undefined) {
      throw new Error(`Active graph node is unavailable: ${nodeId}`);
    }

    this.app.canvas?.selectItems?.([node]);

    if (node.boundingRect !== undefined) {
      this.app.canvas?.animateToBounds?.(node.boundingRect, { duration: 250, zoom: options.zoom });
    }
  }

  readSettingNumber(settingId: string, fallback: number): number {
    const value = this.readSetting(settingId);
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  readSettingBoolean(settingId: string, fallback: boolean): boolean {
    const value = this.readSetting(settingId);
    return typeof value === "boolean" ? value : fallback;
  }

  async listWorkflowEntries(): Promise<readonly WorkflowEntry[]> {
    const [workflows, templates] = await Promise.all([this.readSavedWorkflowEntries(), this.readTemplateEntries()]);
    return [...workflows, ...templates];
  }

  async loadWorkflow(path: string): Promise<void> {
    const { payload } = await this.fetchRequiredJsonObject("workflow", path, [
      { route: `/userdata/${encodeURIComponent(path)}`, source: "api" },
    ]);
    await this.loadGraphPayload("workflow", path, payload);
  }

  async loadTemplate(path: string): Promise<void> {
    const { payload } = await this.fetchRequiredJsonObject("template", path, templateLoadRoutes(path));
    await this.loadGraphPayload("template", path, payload, { openSource: "template" });
  }

  private activeGraphNodes(): readonly LiteGraphNodeLike[] {
    return this.activeGraph()?.nodes ?? [];
  }

  private activeGraph(): LiteGraphLike | undefined {
    return this.app.canvas?.graph ?? this.app.rootGraph ?? undefined;
  }

  private readSetting(settingId: string): JsonValue | undefined {
    try {
      return this.app.extensionManager?.setting?.get?.(settingId);
    } catch {
      return undefined;
    }
  }

  private readCommandShortcuts(): ReadonlyMap<string, string> {
    const entries = [
      ...keybindingsFromRegistry(this.app.extensionManager?.keybinding),
      ...keybindingsFromRegistry(this.app.extensionManager?.keybindings),
      ...keybindingsFromRegistry(this.app.extensionManager?.keybindingStore),
    ];
    const shortcuts = new Map<string, string>();

    for (const entry of entries) {
      if (entry.commandId === undefined || entry.combo === undefined) {
        continue;
      }

      const shortcut = formatKeybindingCombo(entry.combo);
      if (shortcut.length > 0) {
        shortcuts.set(entry.commandId, shortcut);
      }
    }

    for (const command of this.commandEntries()) {
      const keybinding = command.keybinding
        ?? this.app.extensionManager?.keybinding?.getKeybindingByCommandId?.(command.id)
        ?? this.app.extensionManager?.keybindings?.getKeybindingByCommandId?.(command.id)
        ?? this.app.extensionManager?.keybindingStore?.getKeybindingByCommandId?.(command.id);
      if (keybinding?.combo === undefined) {
        continue;
      }

      const shortcut = formatKeybindingCombo(keybinding.combo);
      if (shortcut.length > 0) {
        shortcuts.set(command.id, shortcut);
      }
    }

    return shortcuts;
  }

  private readFrontendNodeDefinitions(): readonly NodeDefinitionSummary[] {
    const registered = globalThis.LiteGraph?.registered_node_types;

    if (registered === undefined) {
      return [];
    }

    return Object.entries(registered).map(([nodeClass, definition]) => ({
      nodeClass,
      displayName: definition.title ?? definition.prototype?.title ?? definition.name ?? nodeClass,
      category: definition.category ?? "",
      description: "",
      isApiNode: false,
    }));
  }

  private placeNodeAtViewportCenter(node: LiteGraphCreatedNodeLike): void {
    const position = this.readViewportCenter() ?? this.readGraphMousePosition() ?? { x: 0, y: 0 };

    if (node.pos === undefined) {
      node.pos = [position.x, position.y];
      return;
    }

    node.pos[0] = position.x;
    node.pos[1] = position.y;
  }

  private readViewportCenter(): { readonly x: number; readonly y: number } | undefined {
    const visibleArea = this.app.canvas?.ds?.visible_area;

    if (!isNumericBounds(visibleArea)) {
      return undefined;
    }

    return {
      x: visibleArea[0] + visibleArea[2] / 2,
      y: visibleArea[1] + visibleArea[3] / 2,
    };
  }

  private readGraphMousePosition(): { readonly x: number; readonly y: number } | undefined {
    const graphMouse = this.app.canvas?.graph_mouse;

    if (!isPositionLike(graphMouse)) {
      return undefined;
    }

    return {
      x: graphMouse[0],
      y: graphMouse[1],
    };
  }

  private async readNodeDefinitionPayload(): Promise<JsonObject> {
    const api = this.app.api;

    if (api?.getNodeDefs !== undefined) {
      const payload = await api.getNodeDefs();
      return isJsonObject(payload) ? payload : {};
    }

    if (api?.fetchApi === undefined) {
      return {};
    }

    const response = await api.fetchApi("/object_info");

    if (!response.ok) {
      return {};
    }

    const payload: JsonValue = await response.json();

    return isJsonObject(payload) ? payload : {};
  }

  private async readSavedWorkflowEntries(): Promise<readonly WorkflowEntry[]> {
    const payload = await this.readJsonArray("/userdata?dir=workflows&recurse=true&full_info=true");

    return payload.flatMap((entry): readonly WorkflowEntry[] => {
      if (!isJsonObject(entry)) {
        return [];
      }

      const path = readString(entry, "path");

      if (path === undefined) {
        return [];
      }

      const loadPath = savedWorkflowLoadPath(path);
      const title = readString(entry, "name") ?? pathBasename(path);

      return [
        {
          id: `workflow:${loadPath}`,
          title,
          subtitle: loadPath,
          kind: "workflow",
          path: loadPath,
        },
      ];
    });
  }

  private async readTemplateEntries(): Promise<readonly WorkflowEntry[]> {
    const [coreTemplates, customNodeTemplates] = await Promise.all([
      this.readCoreTemplateEntries(),
      this.readCustomNodeTemplateEntries(),
    ]);

    if (coreTemplates.length > 0 || customNodeTemplates.length > 0) {
      return [...coreTemplates, ...customNodeTemplates];
    }

    return this.readLegacyTemplateEntries();
  }

  private async readCoreTemplateEntries(): Promise<readonly WorkflowEntry[]> {
    const api = this.app.api;

    if (api?.getCoreWorkflowTemplates === undefined) {
      return [];
    }

    try {
      const payload = await api.getCoreWorkflowTemplates();
      return coreTemplateCategoriesToEntries(payload);
    } catch {
      return [];
    }
  }

  private async readCustomNodeTemplateEntries(): Promise<readonly WorkflowEntry[]> {
    const api = this.app.api;

    if (api?.getWorkflowTemplates !== undefined) {
      try {
        const payload = await api.getWorkflowTemplates();
        const entries = workflowTemplateMapToEntries(payload);
        if (entries.length > 0) {
          return entries;
        }
      } catch {
        // Fall through to route probes below.
      }
    }

    const payload = await this.readJsonObjectFromRoutes(["/workflow_templates", "/api/workflow_templates"]);
    return payload === undefined ? [] : workflowTemplateMapToEntries(payload);
  }

  private async readLegacyTemplateEntries(): Promise<readonly WorkflowEntry[]> {
    const payload = await this.readStaticJsonArray("/templates/index.json");
    return templateCategoriesToEntries(payload, "path");
  }

  private async readJsonObjectFromRoutes(routes: readonly string[]): Promise<JsonObject | undefined> {
    for (const route of routes) {
      const response = await this.fetchRoute(route);

      if (response === undefined || !response.ok) {
        continue;
      }

      try {
        const payload: JsonValue = await response.json();
        if (isJsonObject(payload)) {
          return payload;
        }
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private async readJsonArray(route: string): Promise<readonly JsonValue[]> {
    const response = await this.fetchRoute(route);

    if (response === undefined || !response.ok) {
      return [];
    }

    try {
      const payload: JsonValue = await response.json();
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  }

  private async readStaticJsonArray(route: string): Promise<readonly JsonValue[]> {
    const response = await this.fetchStaticRoute(route);

    if (response === undefined || !response.ok) {
      return [];
    }

    try {
      const payload: JsonValue = await response.json();
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  }

  private async fetchRoute(route: string): Promise<Response | undefined> {
    const api = this.app.api;

    if (api?.fetchApi === undefined) {
      return undefined;
    }

    try {
      return await api.fetchApi(route);
    } catch {
      return undefined;
    }
  }

  private async fetchStaticRoute(route: string): Promise<Response | undefined> {
    const api = this.app.api;

    if (api?.fileURL === undefined && api?.fetchApi === undefined) {
      return undefined;
    }

    try {
      return await this.fetchStaticRouteRequired(route);
    } catch {
      return undefined;
    }
  }

  private async fetchStaticRouteRequired(route: string): Promise<Response> {
    const api = this.app.api;

    if (api?.fileURL !== undefined) {
      return await globalThis.fetch(api.fileURL(route));
    }

    if (api?.fetchApi !== undefined) {
      return await api.fetchApi(route);
    }

    return await globalThis.fetch(route);
  }

  private async fetchRequiredJsonObject(
    kind: WorkflowEntry["kind"],
    path: string,
    routes: readonly RouteCandidate[],
  ): Promise<{ readonly route: string; readonly payload: JsonObject }> {
    let lastHttpError = "";

    for (const candidate of routes) {
      const route = candidate.route;
      let response: Response | undefined;

      try {
        response =
          candidate.source === "api" ? await this.fetchRequiredApiRoute(kind, path, route) : await this.fetchStaticRouteRequired(route);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(`Cannot load ${kind}`)) {
          throw error;
        }

        const message = error instanceof Error ? error.message : "unknown error";
        throw new Error(`Failed to load ${kind} from ${route}: ${message}`);
      }

      if (response === undefined) {
        throw new Error(`Failed to load ${kind} from ${route}: empty response`);
      }

      if (!response.ok) {
        lastHttpError = `Failed to load ${kind} from ${route}: HTTP ${response.status}`;
        if (response.status === 404 && candidate !== routes[routes.length - 1]) {
          continue;
        }

        throw new Error(lastHttpError);
      }

      try {
        const payload: JsonValue = await response.json();
        if (!isJsonObject(payload)) {
          throw new Error("response JSON was not an object");
        }

        return { route, payload };
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid JSON";
        throw new Error(`Failed to parse ${kind} JSON from ${route}: ${message}`);
      }
    }

    throw new Error(lastHttpError || `Failed to load ${kind}: no routes were available`);
  }

  private async fetchRequiredApiRoute(
    kind: WorkflowEntry["kind"],
    path: string,
    route: string,
  ): Promise<Response | undefined> {
    const api = this.app.api;

    if (api?.fetchApi === undefined) {
      throw new Error(`Cannot load ${kind} because ComfyUI fetchApi is unavailable: ${path}`);
    }

    return await api.fetchApi(route);
  }

  private async loadGraphPayload(
    kind: WorkflowEntry["kind"],
    path: string,
    payload: JsonObject,
    options?: LoadGraphOptions,
  ): Promise<void> {
    const app = this.app;

    if (app.loadGraphData === undefined) {
      throw new Error(`Cannot load ${kind} because ComfyUI graph loader is unavailable: ${path}`);
    }

    if (options === undefined) {
      await app.loadGraphData(payload, true, true, path);
      return;
    }

    await app.loadGraphData(payload, true, true, path, options);
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumericBounds(
  value: LiteGraphBoundsLike | undefined,
): value is LiteGraphPositionLike & { readonly 2: number; readonly 3: number } {
  return (
    value !== undefined &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2]) &&
    isFiniteNumber(value[3])
  );
}

function isPositionLike(value: LiteGraphPositionLike | undefined): value is LiteGraphPositionLike {
  return value !== undefined && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function readGraphAdd(graph: LiteGraphLike | undefined): ((node: LiteGraphCreatedNodeLike) => void) | undefined {
  const add = graph?.add;

  if (typeof add !== "function") {
    return undefined;
  }

  return add as (node: LiteGraphCreatedNodeLike) => void;
}

function readString(object: JsonObject, key: string): string | undefined {
  const value = object[key];
  return typeof value === "string" ? value : undefined;
}

function readBoolean(object: JsonObject, key: string): boolean | undefined {
  const value = object[key];
  return typeof value === "boolean" ? value : undefined;
}

function nodeDefinitionFromPayload(nodeClass: string, definition: JsonValue): NodeDefinitionSummary {
  const definitionObject = isJsonObject(definition) ? definition : {};
  const displayName = readString(definitionObject, "display_name") ?? readString(definitionObject, "name") ?? nodeClass;

  return {
    nodeClass,
    displayName,
    category: readString(definitionObject, "category") ?? "",
    description: readString(definitionObject, "description") ?? "",
    isApiNode: isApiNodeDefinition(definitionObject),
  };
}

function isApiNodeDefinition(definition: JsonObject): boolean {
  if (
    readBoolean(definition, "api_node") === true
    || readBoolean(definition, "is_api_node") === true
    || readBoolean(definition, "isApiNode") === true
  ) {
    return true;
  }

  const source = readString(definition, "source")?.toLowerCase();
  return source === "api" || source === "api node" || source === "api_node";
}

function commandWithId(commandId: string, command: CommandLike | object): CommandLike {
  if (isCommandObject(command) && command.id !== undefined) {
    return command;
  }

  return { id: commandId };
}

function isCommandObject(value: object): value is CommandLike {
  return "id" in value && typeof value.id === "string";
}

function readStringValue(value: string | StringFactory | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "function") {
    try {
      const result = value();
      return typeof result === "string" ? result : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function commandIdToTitle(commandId: string): string {
  const segments = commandId.split(/[.:/]/).filter((segment) => segment.length > 0);
  const finalSegment = segments[segments.length - 1] ?? commandId;
  const withSpaces = finalSegment
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (withSpaces.length === 0) {
    return commandId;
  }

  return withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value === undefined || value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function keybindingsFromRegistry(registry: KeybindingRegistryLike | undefined): readonly KeybindingLike[] {
  if (registry === undefined) {
    return [];
  }

  return [...keybindingsFromValue(registry.keybindings), ...keybindingsFromValue(registry.bindings)];
}

function keybindingsFromValue(
  value: readonly KeybindingLike[] | Readonly<Record<string, KeybindingLike>> | undefined,
): readonly KeybindingLike[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : Object.values(value);
}

function formatKeybindingCombo(combo: KeybindingComboLike): string {
  if (combo.getKeySequences !== undefined) {
    try {
      return combo.getKeySequences().map(formatKeyName).join("+");
    } catch {
      return "";
    }
  }

  const key = combo.key;
  if (key === undefined || key.length === 0) {
    return "";
  }

  const parts = [
    combo.ctrl === true ? "Ctrl" : undefined,
    combo.meta === true ? "Meta" : undefined,
    combo.alt === true ? "Alt" : undefined,
    combo.shift === true ? "Shift" : undefined,
    formatKeyName(key),
  ];

  return parts.filter((part): part is string => part !== undefined).join("+");
}

function formatKeyName(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

function coreTemplateCategoriesToEntries(payload: readonly CoreWorkflowTemplateCategory[]): readonly WorkflowEntry[] {
  return payload.flatMap((category): readonly WorkflowEntry[] => {
    const templates = category.templates ?? [];
    const moduleName = category.moduleName ?? category.title ?? "";

    return templates.flatMap((entry): readonly WorkflowEntry[] => {
      const path = entry.name ?? entry.id;

      if (path === undefined) {
        return [];
      }

      return [
        {
          id: `template:${path}`,
          title: entry.localizedTitle ?? entry.title ?? pathBasename(path),
          subtitle: moduleName.length > 0 ? moduleName : path,
          kind: "template",
          path,
        },
      ];
    });
  });
}

function templateCategoriesToEntries(
  payload: readonly JsonValue[],
  subtitleMode: "module" | "path",
): readonly WorkflowEntry[] {
  return payload.flatMap((category): readonly WorkflowEntry[] => {
    if (!isJsonObject(category)) {
      return [];
    }

    const templates = category.templates;

    if (!Array.isArray(templates)) {
      return [];
    }

    const moduleName = readString(category, "moduleName") ?? readString(category, "title") ?? "";

    return templates.flatMap((entry): readonly WorkflowEntry[] => {
      if (!isJsonObject(entry)) {
        return [];
      }

      const path = readString(entry, "name") ?? readString(entry, "id");

      if (path === undefined) {
        return [];
      }

      return [
        {
          id: `template:${path}`,
          title: readString(entry, "localizedTitle") ?? readString(entry, "title") ?? pathBasename(path),
          subtitle: subtitleMode === "module" && moduleName.length > 0 ? moduleName : path,
          kind: "template",
          path,
        },
      ];
    });
  });
}

function workflowTemplateMapToEntries(payload: JsonObject | WorkflowTemplateMap): readonly WorkflowEntry[] {
  return Object.entries(payload).flatMap(([moduleName, templates]): readonly WorkflowEntry[] => {
    if (!Array.isArray(templates)) {
      return [];
    }

    return templates.flatMap((templateName): readonly WorkflowEntry[] => {
      if (typeof templateName !== "string") {
        return [];
      }

      const path = `${moduleName}/${templateName}`;

      return [
        {
          id: `template:${path}`,
          title: templateName,
          subtitle: path,
          kind: "template",
          path,
        },
      ];
    });
  });
}

function templateLoadRoutes(path: string): readonly RouteCandidate[] {
  const templateRoute: RouteCandidate = {
    route: `/templates/${encodePathSegments(path)}.json`,
    source: "static",
  };

  if (!path.includes("/")) {
    return [templateRoute];
  }

  return [
    {
      route: `/workflow_templates/${encodePathSegments(path)}.json`,
      source: "api",
    },
    templateRoute,
  ];
}

function encodePathSegments(path: string): string {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function savedWorkflowLoadPath(path: string): string {
  return path === "workflows" || path.startsWith("workflows/") ? path : `workflows/${path}`;
}

function pathBasename(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments.length === 0 ? path : segments[segments.length - 1];
}
