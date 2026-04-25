import { afterEach, describe, expect, it, vi } from "vitest";
import { ComfyAdapter, type ApiLike, type ComfyAppLike, type WorkflowEntry } from "../../src/palette/comfy-adapter";
import { createWorkflowsProvider } from "../../src/palette/providers/workflows";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComfyAdapter workflow entries", () => {
  it("combines valid saved workflow, core template, and custom-node template payloads", async () => {
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/userdata?dir=workflows&recurse=true&full_info=true") {
        return new Response(
          JSON.stringify([
            { path: "workflows/Portrait.json", name: "Portrait Workflow" },
            { path: "workflows/character/lighting-test.json", size: 1200, modified: 1710000000 },
            "bad",
          ]),
        );
      }

      if (route === "/workflow_templates") {
        return new Response(
          JSON.stringify({
            "custom-pack": ["Starter Template", "Advanced Template"],
          }),
        );
      }

      return new Response("not found", { status: 404 });
    });
    const getCoreWorkflowTemplates = vi.fn<() => readonly WorkflowTemplatesPayload[]>(() => [
      {
        moduleName: "default",
        title: "Image",
        templates: [
          { name: "01_get_started_text_to_image", title: "Get Started: Text to Image" },
          { name: "missing-title" },
          {},
        ],
      },
      { moduleName: "bad", title: "Bad Category" },
    ]);
    const adapter = new ComfyAdapter({ api: { fetchApi, getCoreWorkflowTemplates } });

    await expect(adapter.listWorkflowEntries()).resolves.toEqual([
      {
        id: "workflow:workflows/Portrait.json",
        title: "Portrait Workflow",
        subtitle: "workflows/Portrait.json",
        kind: "workflow",
        path: "workflows/Portrait.json",
      },
      {
        id: "workflow:workflows/character/lighting-test.json",
        title: "lighting-test.json",
        subtitle: "workflows/character/lighting-test.json",
        kind: "workflow",
        path: "workflows/character/lighting-test.json",
      },
      {
        id: "template:01_get_started_text_to_image",
        title: "Get Started: Text to Image",
        subtitle: "default",
        kind: "template",
        path: "01_get_started_text_to_image",
      },
      {
        id: "template:missing-title",
        title: "missing-title",
        subtitle: "default",
        kind: "template",
        path: "missing-title",
      },
      {
        id: "template:custom-pack/Starter Template",
        title: "Starter Template",
        subtitle: "custom-pack/Starter Template",
        kind: "template",
        path: "custom-pack/Starter Template",
      },
      {
        id: "template:custom-pack/Advanced Template",
        title: "Advanced Template",
        subtitle: "custom-pack/Advanced Template",
        kind: "template",
        path: "custom-pack/Advanced Template",
      },
    ]);
  });

  it("preserves api receivers when reading core and custom-node template APIs", async () => {
    const adapter = new ComfyAdapter({
      api: new ReceiverSensitiveTemplateApi(),
    });

    await expect(adapter.listWorkflowEntries()).resolves.toEqual([
      {
        id: "template:receiver-core",
        title: "Receiver Core Template",
        subtitle: "receiver-core-pack",
        kind: "template",
        path: "receiver-core",
      },
      {
        id: "template:receiver-custom-pack/Receiver Custom Template",
        title: "Receiver Custom Template",
        subtitle: "receiver-custom-pack/Receiver Custom Template",
        kind: "template",
        path: "receiver-custom-pack/Receiver Custom Template",
      },
    ]);
  });

  it("falls back from /workflow_templates to /api/workflow_templates for custom-node templates", async () => {
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/api/workflow_templates") {
        return new Response(JSON.stringify({ "custom-pack": ["Starter Template"] }));
      }

      return new Response("not found", { status: 404 });
    });
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.listWorkflowEntries()).resolves.toEqual([
      {
        id: "template:custom-pack/Starter Template",
        title: "Starter Template",
        subtitle: "custom-pack/Starter Template",
        kind: "template",
        path: "custom-pack/Starter Template",
      },
    ]);
    expect(fetchApi).toHaveBeenCalledWith("/workflow_templates");
    expect(fetchApi).toHaveBeenCalledWith("/api/workflow_templates");
  });

  it("uses legacy /templates/index.json only after verified template sources are unavailable", async () => {
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/templates/index.json") {
        return new Response(
          JSON.stringify([
            {
              moduleName: "default",
              category: "Generation Type",
              templates: [
                { name: "template_contact_sheet-step_2.app", title: "Step 2: Contact Sheet Workflow" },
                { id: "legacy-template", title: "Legacy Template" },
              ],
            },
          ]),
        );
      }

      return new Response("not found", { status: 404 });
    });
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.listWorkflowEntries()).resolves.toEqual([
      {
        id: "template:template_contact_sheet-step_2.app",
        title: "Step 2: Contact Sheet Workflow",
        subtitle: "template_contact_sheet-step_2.app",
        kind: "template",
        path: "template_contact_sheet-step_2.app",
      },
      {
        id: "template:legacy-template",
        title: "Legacy Template",
        subtitle: "legacy-template",
        kind: "template",
        path: "legacy-template",
      },
    ]);
    expect(fetchApi).toHaveBeenNthCalledWith(1, "/userdata?dir=workflows&recurse=true&full_info=true");
    expect(fetchApi).toHaveBeenNthCalledWith(2, "/workflow_templates");
    expect(fetchApi).toHaveBeenNthCalledWith(3, "/api/workflow_templates");
    expect(fetchApi).toHaveBeenNthCalledWith(4, "/templates/index.json");
  });

  it("returns an empty list when workflow endpoints are unavailable or invalid", async () => {
    const unavailableAdapter = new ComfyAdapter({});

    await expect(unavailableAdapter.listWorkflowEntries()).resolves.toEqual([]);

    const badResponseAdapter = new ComfyAdapter({
      api: {
        fetchApi: () => new Response(JSON.stringify({ not: "an array" }), { status: 500 }),
      },
    });

    await expect(badResponseAdapter.listWorkflowEntries()).resolves.toEqual([]);
  });

  it("parses workflow JSON and loads it through ComfyUI graph loading API", async () => {
    const workflow = { nodes: [], links: [] };
    const fetchApi = vi.fn<(route: string) => Response>(() => new Response(JSON.stringify(workflow)));
    const loadGraphData = vi.fn<
      (
        graphData?: object,
        clean?: boolean,
        restoreView?: boolean,
        workflowName?: string | null,
      ) => void
    >();
    const adapter = new ComfyAdapter({ api: { fetchApi }, loadGraphData });

    await adapter.loadWorkflow("workflows/Portrait Study.json");

    expect(fetchApi).toHaveBeenCalledWith("/userdata/workflows%2FPortrait%20Study.json");
    expect(loadGraphData).toHaveBeenCalledWith(workflow, true, true, "workflows/Portrait Study.json");
  });

  it("preserves fetchApi and loadGraphData receivers when loading saved workflows", async () => {
    const workflow = { nodes: [], links: [] };
    const api = new ReceiverSensitiveWorkflowApi(workflow);
    const app = new ReceiverSensitiveWorkflowApp(api);
    const adapter = new ComfyAdapter(app);

    await adapter.loadWorkflow("workflows/Receiver Study.json");

    expect(api.fetchedRoutes).toEqual(["/userdata/workflows%2FReceiver%20Study.json"]);
    expect(app.loadedGraphs).toEqual([
      {
        graphData: workflow,
        clean: true,
        restoreView: true,
        workflow: "workflows/Receiver Study.json",
        options: undefined,
      },
    ]);
  });

  it("loads path-only saved workflow entries from the workflows userdata directory", async () => {
    const workflow = { nodes: [], links: [] };
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/userdata?dir=workflows&recurse=true&full_info=true") {
        return new Response(JSON.stringify([{ path: "Portrait.json" }]));
      }

      return new Response(JSON.stringify(workflow));
    });
    const loadGraphData = vi.fn<
      (
        graphData?: object,
        clean?: boolean,
        restoreView?: boolean,
        workflowName?: string | null,
      ) => void
    >();
    const adapter = new ComfyAdapter({ api: { fetchApi }, loadGraphData });
    const [entry] = await adapter.listWorkflowEntries();

    await adapter.loadWorkflow(entry?.path ?? "");

    expect(entry).toMatchObject({
      title: "Portrait.json",
      subtitle: "workflows/Portrait.json",
      path: "workflows/Portrait.json",
    });
    expect(fetchApi).toHaveBeenLastCalledWith("/userdata/workflows%2FPortrait.json");
    expect(loadGraphData).toHaveBeenCalledWith(workflow, true, true, "workflows/Portrait.json");
  });

  it("loads nested saved workflow entries as one encoded userdata file segment", async () => {
    const workflow = { nodes: [], links: [] };
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/userdata?dir=workflows&recurse=true&full_info=true") {
        return new Response(JSON.stringify([{ path: "portraits/Studio Test.json" }]));
      }

      return new Response(JSON.stringify(workflow));
    });
    const loadGraphData = vi.fn<
      (
        graphData?: object,
        clean?: boolean,
        restoreView?: boolean,
        workflowName?: string | null,
      ) => void
    >();
    const adapter = new ComfyAdapter({ api: { fetchApi }, loadGraphData });
    const [entry] = await adapter.listWorkflowEntries();

    await adapter.loadWorkflow(entry?.path ?? "");

    expect(entry).toMatchObject({
      title: "Studio Test.json",
      subtitle: "workflows/portraits/Studio Test.json",
      path: "workflows/portraits/Studio Test.json",
    });
    expect(fetchApi).toHaveBeenLastCalledWith("/userdata/workflows%2Fportraits%2FStudio%20Test.json");
    expect(loadGraphData).toHaveBeenCalledWith(workflow, true, true, "workflows/portraits/Studio Test.json");
  });

  it("keeps already-prefixed saved workflow paths single-prefixed", async () => {
    const workflow = { nodes: [], links: [] };
    const fetchApi = vi.fn<(route: string) => Response>((route) => {
      if (route === "/userdata?dir=workflows&recurse=true&full_info=true") {
        return new Response(JSON.stringify([{ path: "workflows/Portrait.json" }]));
      }

      return new Response(JSON.stringify(workflow));
    });
    const loadGraphData = vi.fn<
      (
        graphData?: object,
        clean?: boolean,
        restoreView?: boolean,
        workflowName?: string | null,
      ) => void
    >();
    const adapter = new ComfyAdapter({ api: { fetchApi }, loadGraphData });
    const [entry] = await adapter.listWorkflowEntries();

    await adapter.loadWorkflow(entry?.path ?? "");

    expect(entry).toMatchObject({
      subtitle: "workflows/Portrait.json",
      path: "workflows/Portrait.json",
    });
    expect(fetchApi).toHaveBeenLastCalledWith("/userdata/workflows%2FPortrait.json");
    expect(loadGraphData).toHaveBeenCalledWith(workflow, true, true, "workflows/Portrait.json");
  });

  it("parses template workflow JSON and loads it through ComfyUI graph loading API", async () => {
    const workflow = { nodes: [], links: [] };
    const fetchApi = vi.fn<(route: string) => Response>(() => new Response(JSON.stringify(workflow)));
    const loadGraphData = vi.fn<
      (
        graphData?: object,
        clean?: boolean,
        restoreView?: boolean,
        workflowName?: string | null,
        options?: { readonly openSource?: "file_button" | "file_drop" | "template" | "unknown" },
      ) => void
    >();
    const adapter = new ComfyAdapter({ api: { fetchApi }, loadGraphData });

    await adapter.loadTemplate("custom-pack/Portrait Study");

    expect(fetchApi).toHaveBeenCalledWith("/workflow_templates/custom-pack/Portrait%20Study.json");
    expect(loadGraphData).toHaveBeenCalledWith(workflow, true, true, "custom-pack/Portrait Study", {
      openSource: "template",
    });
  });

  it("preserves fileURL and loadGraphData receivers when loading static templates", async () => {
    const workflow = { nodes: [], links: [] };
    const api = new ReceiverSensitiveStaticTemplateApi();
    const app = new ReceiverSensitiveWorkflowApp(api);
    const fetchStatic = vi.fn<(route: string) => Response>((route) => {
      expect(route).toBe("/resolved/templates/Receiver%20Template.json");
      return new Response(JSON.stringify(workflow));
    });
    vi.stubGlobal("fetch", fetchStatic);
    const adapter = new ComfyAdapter(app);

    await adapter.loadTemplate("Receiver Template");

    expect(api.resolvedRoutes).toEqual(["/templates/Receiver%20Template.json"]);
    expect(fetchStatic).toHaveBeenCalledWith("/resolved/templates/Receiver%20Template.json");
    expect(app.loadedGraphs).toEqual([
      {
        graphData: workflow,
        clean: true,
        restoreView: true,
        workflow: "Receiver Template",
        options: { openSource: "template" },
      },
    ]);
  });

  it("throws clear workflow load errors when fetchApi is unavailable", async () => {
    const adapter = new ComfyAdapter({});

    await expect(adapter.loadWorkflow("workflows/main.json")).rejects.toThrow(
      "Cannot load workflow because ComfyUI fetchApi is unavailable: workflows/main.json",
    );
  });

  it("throws clear template load errors when fetchApi throws", async () => {
    const fetchApi = vi.fn<(route: string) => Response>(() => {
      throw new Error("network down");
    });
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.loadTemplate("default/basic")).rejects.toThrow(
      "Failed to load template from /workflow_templates/default/basic.json: network down",
    );
  });

  it("throws clear workflow load errors for non-ok responses", async () => {
    const fetchApi = vi.fn<(route: string) => Response>(() => new Response("missing", { status: 404 }));
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.loadWorkflow("workflows/missing.json")).rejects.toThrow(
      "Failed to load workflow from /userdata/workflows%2Fmissing.json: HTTP 404",
    );
  });

  it("throws clear template load errors when fetchApi returns undefined", async () => {
    const fetchApi = vi.fn<(route: string) => Response | undefined>(() => undefined);
    const app = {
      api: { fetchApi },
    } as ComfyAppLike & { readonly api: { readonly fetchApi: (route: string) => Response | undefined } };
    const adapter = new ComfyAdapter(app);

    await expect(adapter.loadTemplate("default/missing")).rejects.toThrow(
      "Failed to load template from /workflow_templates/default/missing.json: empty response",
    );
  });

  it("throws clear load errors when ComfyUI graph loading API is unavailable", async () => {
    const fetchApi = vi.fn<(route: string) => Response>(() => new Response(JSON.stringify({ nodes: [], links: [] })));
    const adapter = new ComfyAdapter({ api: { fetchApi } });

    await expect(adapter.loadWorkflow("workflows/main.json")).rejects.toThrow(
      "Cannot load workflow because ComfyUI graph loader is unavailable: workflows/main.json",
    );
  });
});

describe("createWorkflowsProvider", () => {
  it("matches saved workflows and templates by title, path, and kind", async () => {
    const provider = createWorkflowsProvider({
      listWorkflowEntries: async () => [
        workflowEntry({
          title: "Portrait Workflow",
          subtitle: "workflows/portraits/main.json",
          kind: "workflow",
          path: "workflows/portraits/main.json",
        }),
        workflowEntry({
          title: "Starter Template",
          subtitle: "templates/starter",
          kind: "template",
          path: "templates/starter",
        }),
      ],
      loadWorkflow: () => undefined,
      loadTemplate: () => undefined,
    });

    const titleResults = await provider.search(
      { raw: "portrait", prefix: "all", term: "portrait" },
      { now: () => 100 },
    );
    const pathResults = await provider.search(
      { raw: "starter", prefix: "all", term: "starter" },
      { now: () => 100 },
    );
    const kindResults = await provider.search(
      { raw: "template", prefix: "all", term: "template" },
      { now: () => 100 },
    );

    expect(titleResults.map((result) => result.id)).toEqual(["workflow:workflows/portraits/main.json"]);
    expect(pathResults.map((result) => result.id)).toEqual(["template:templates/starter"]);
    expect(kindResults.map((result) => result.id)).toEqual(["template:templates/starter"]);
    expect(kindResults[0]).toMatchObject({
      providerId: "workflows",
      title: "Starter Template",
      subtitle: "templates/starter",
      keywords: ["templates/starter", "template"],
      group: "Templates",
    });
  });

  it("loads a selected workflow by path", async () => {
    const loadWorkflow = vi.fn<(path: string) => void>();
    const provider = createWorkflowsProvider({
      listWorkflowEntries: async () => [
        workflowEntry({ kind: "workflow", path: "workflows/main.json", title: "Main Workflow" }),
      ],
      loadWorkflow,
      loadTemplate: () => undefined,
    });

    const results = await provider.search({ raw: "main", prefix: "all", term: "main" }, { now: () => 100 });

    await results[0]?.execute();

    expect(loadWorkflow).toHaveBeenCalledWith("workflows/main.json");
  });

  it("loads a selected template by path", async () => {
    const loadTemplate = vi.fn<(path: string) => void>();
    const provider = createWorkflowsProvider({
      listWorkflowEntries: async () => [
        workflowEntry({ kind: "template", path: "default/basic", title: "Basic Template" }),
      ],
      loadWorkflow: () => undefined,
      loadTemplate,
    });

    const results = await provider.search({ raw: "basic", prefix: "all", term: "basic" }, { now: () => 100 });

    await results[0]?.execute();

    expect(loadTemplate).toHaveBeenCalledWith("default/basic");
  });

  it("ranks saved workflows ahead of templates for an empty workflow search", async () => {
    const provider = createWorkflowsProvider({
      listWorkflowEntries: async () => [
        workflowEntry({
          kind: "template",
          path: "default/basic",
          title: "Basic Template",
        }),
        workflowEntry({
          kind: "workflow",
          path: "workflows/exampletestowk.json",
          title: "exampletestowk",
        }),
      ],
      loadWorkflow: () => undefined,
      loadTemplate: () => undefined,
    });

    const results = await provider.search({ raw: "#", prefix: "workflows", term: "" }, { now: () => 100 });

    expect(results.map((result) => result.id)).toEqual([
      "workflow:workflows/exampletestowk.json",
      "template:default/basic",
    ]);
  });
});

function workflowEntry(entry: Partial<WorkflowEntry> & Pick<WorkflowEntry, "kind" | "path" | "title">): WorkflowEntry {
  return {
    id: `${entry.kind}:${entry.path}`,
    title: entry.title,
    subtitle: entry.subtitle ?? entry.path,
    kind: entry.kind,
    path: entry.path,
  };
}

type WorkflowTemplatesPayload = {
  readonly moduleName?: string;
  readonly title?: string;
  readonly templates?: readonly WorkflowTemplatePayload[];
};

type WorkflowTemplatePayload = {
  readonly name?: string;
  readonly id?: string;
  readonly title?: string;
  readonly localizedTitle?: string;
};

type LoadGraphDataParams = Parameters<NonNullable<ComfyAppLike["loadGraphData"]>>;

type LoadedGraphCall = {
  readonly graphData: LoadGraphDataParams[0];
  readonly clean: LoadGraphDataParams[1];
  readonly restoreView: LoadGraphDataParams[2];
  readonly workflow: LoadGraphDataParams[3];
  readonly options: LoadGraphDataParams[4];
};

class ReceiverSensitiveTemplateApi implements ApiLike {
  readonly marker = "template-api";

  getCoreWorkflowTemplates(): ReturnType<NonNullable<ApiLike["getCoreWorkflowTemplates"]>> {
    this.assertReceiver("getCoreWorkflowTemplates");
    return [
      {
        moduleName: "receiver-core-pack",
        templates: [{ name: "receiver-core", title: "Receiver Core Template" }],
      },
    ];
  }

  getWorkflowTemplates(): ReturnType<NonNullable<ApiLike["getWorkflowTemplates"]>> {
    this.assertReceiver("getWorkflowTemplates");
    return {
      "receiver-custom-pack": ["Receiver Custom Template"],
    };
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "template-api") {
      throw new Error(`${method} lost receiver`);
    }
  }
}

class ReceiverSensitiveWorkflowApi implements ApiLike {
  readonly marker = "workflow-api";
  readonly fetchedRoutes: string[] = [];

  constructor(private readonly workflow: object) {}

  fetchApi(route: string): Response {
    this.assertReceiver("fetchApi");
    this.fetchedRoutes.push(route);
    return new Response(JSON.stringify(this.workflow));
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "workflow-api") {
      throw new Error(`${method} lost receiver`);
    }
  }
}

class ReceiverSensitiveStaticTemplateApi implements ApiLike {
  readonly marker = "static-template-api";
  readonly resolvedRoutes: string[] = [];

  fileURL(route: string): string {
    this.assertReceiver("fileURL");
    this.resolvedRoutes.push(route);
    return `/resolved${route}`;
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "static-template-api") {
      throw new Error(`${method} lost receiver`);
    }
  }
}

class ReceiverSensitiveWorkflowApp implements ComfyAppLike {
  readonly marker = "workflow-app";
  readonly loadedGraphs: LoadedGraphCall[] = [];

  constructor(readonly api: ApiLike) {}

  loadGraphData(
    graphData?: LoadGraphDataParams[0],
    clean?: LoadGraphDataParams[1],
    restoreView?: LoadGraphDataParams[2],
    workflow?: LoadGraphDataParams[3],
    options?: LoadGraphDataParams[4],
  ): void {
    this.assertReceiver("loadGraphData");
    this.loadedGraphs.push({ graphData, clean, restoreView, workflow, options });
  }

  private assertReceiver(method: string): void {
    if (this.marker !== "workflow-app") {
      throw new Error(`${method} lost receiver`);
    }
  }
}
