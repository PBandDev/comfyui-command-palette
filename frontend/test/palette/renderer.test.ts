import { describe, expect, it, vi } from "vitest";
import { PaletteController } from "../../src/palette/controller";
import { PaletteRenderer } from "../../src/palette/renderer";
import type { PaletteResult } from "../../src/palette/types";

function makeResult(id: string, title: string): PaletteResult {
  return {
    id,
    providerId: "commands",
    title,
    subtitle: "Comfy.Canvas.FitView",
    keywords: ["view", "canvas"],
    shortcut: "Ctrl+F",
    score: 10,
    group: "Commands",
    execute: () => undefined,
  };
}

function makeDisabledResult(id: string, title: string): PaletteResult {
  return {
    ...makeResult(id, title),
    disabledReason: "Disabled in this context",
  };
}

describe("PaletteRenderer", () => {
  it("can render an open dialog with a result and then destroy", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const controller = new PaletteController();
    controller.registerResults([makeResult("command:zoomToFit", "Zoom to Fit")]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: async (result) => {
        await result.execute();
      },
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const dialog = host.querySelector('[data-command-palette="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-label")).toBe("ComfyUI command palette");
    expect(dialog?.textContent).toContain("Zoom to Fit");

    const input = host.querySelector(".cp-input");
    expect(input?.getAttribute("aria-label")).toBe("Search ComfyUI commands");

    renderer.destroy();
    controller.destroy();
  });

  it("executes the active result on Enter", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const executeFirst = vi.fn();
    const executeSecond = vi.fn();
    const first = { ...makeResult("command:first", "First"), execute: executeFirst };
    const second = { ...makeResult("command:second", "Second"), execute: executeSecond };
    const controller = new PaletteController();
    controller.registerResults([first, second]);
    controller.open();
    controller.navigateDown();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    expect(input).not.toBeNull();
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));

    expect(executeFirst).not.toHaveBeenCalled();
    expect(executeSecond).toHaveBeenCalledTimes(1);

    renderer.destroy();
    controller.destroy();
  });

  it("routes arrow keys to navigation callbacks", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const controller = new PaletteController();
    controller.registerResults([makeResult("command:first", "First")]);
    controller.open();

    const onNavigateDown = vi.fn();
    const onNavigateUp = vi.fn();
    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown,
      onNavigateUp,
    });

    renderer.render(controller.getState());

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true, bubbles: true });
    const up = new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true, bubbles: true });
    input?.dispatchEvent(down);
    input?.dispatchEvent(up);

    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(onNavigateDown).toHaveBeenCalledTimes(1);
    expect(onNavigateUp).toHaveBeenCalledTimes(1);

    renderer.destroy();
    controller.destroy();
  });

  it("does not execute disabled results from dispatched clicks", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const execute = vi.fn();
    const result = { ...makeDisabledResult("command:disabled", "Disabled"), execute };
    const controller = new PaletteController();
    controller.registerResults([result]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (selectedResult) => selectedResult.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const title = host.querySelector<HTMLElement>(".cp-title");
    expect(title).not.toBeNull();
    title?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(execute).not.toHaveBeenCalled();

    renderer.destroy();
    controller.destroy();
  });

  it("renders listbox and active option accessibility attributes", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const enabled = makeResult("command:enabled", "Enabled");
    const disabled = makeDisabledResult("command:disabled", "Disabled");
    const controller = new PaletteController();
    controller.registerResults([enabled, disabled]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    const listbox = host.querySelector<HTMLUListElement>(".cp-results");
    const enabledOption = host.querySelector<HTMLButtonElement>('[data-command-palette-option-id="command:enabled"]');
    const disabledOption = host.querySelector<HTMLButtonElement>('[data-command-palette-option-id="command:disabled"]');

    expect(listbox?.id).toBe("command-palette-results");
    expect(listbox?.getAttribute("role")).toBe("listbox");
    expect(input?.getAttribute("aria-controls")).toBe("command-palette-results");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-command:enabled");
    expect(enabledOption?.id).toBe("command-palette-option-command:enabled");
    expect(enabledOption?.getAttribute("role")).toBe("option");
    expect(enabledOption?.getAttribute("aria-selected")).toBe("true");
    expect(enabledOption?.getAttribute("data-command-palette-active")).toBe("true");
    expect(enabledOption?.getAttribute("aria-disabled")).toBe("false");
    expect(disabledOption?.id).toBe("command-palette-option-command:disabled");
    expect(disabledOption?.getAttribute("role")).toBe("option");
    expect(disabledOption?.getAttribute("aria-selected")).toBe("false");
    expect(disabledOption?.getAttribute("data-command-palette-active")).toBe("false");
    expect(disabledOption?.getAttribute("aria-disabled")).toBe("true");

    renderer.destroy();
    controller.destroy();
  });

  it("visibly moves the active row when keyboard navigation changes state", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const first = makeResult("command:first", "First");
    const second = makeResult("command:second", "Second");
    const controller = new PaletteController();
    controller.registerResults([first, second]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());
    controller.navigateDown();
    renderer.render(controller.getState());

    const firstOption = host.querySelector<HTMLButtonElement>('[data-command-palette-option-id="command:first"]');
    const secondOption = host.querySelector<HTMLButtonElement>('[data-command-palette-option-id="command:second"]');

    expect(firstOption?.getAttribute("data-command-palette-active")).toBe("false");
    expect(secondOption?.getAttribute("data-command-palette-active")).toBe("true");
    expect(secondOption?.classList.contains("cp-row-active")).toBe(true);

    renderer.destroy();
    controller.destroy();
  });

  it("restores focus to the previously focused element when the dialog closes", () => {
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "Previous";
    document.body.append(previous);
    previous.focus();

    const host = document.createElement("div");
    document.body.append(host);

    const controller = new PaletteController();
    controller.registerResults([makeResult("command:first", "First")]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    expect(document.activeElement).toBe(input);

    controller.close();
    renderer.render(controller.getState());

    expect(document.activeElement).toBe(previous);

    renderer.destroy();
    controller.destroy();
    previous.remove();
  });

  it("keeps Tab navigation inside the open dialog", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const controller = new PaletteController();
    controller.registerResults([makeResult("command:first", "First")]);
    controller.open();

    const renderer = new PaletteRenderer(host, {
      onInput: (value) => controller.setInput(value),
      onClose: () => controller.close(),
      onExecute: (result) => result.execute(),
      onNavigateDown: () => undefined,
      onNavigateUp: () => undefined,
    });

    renderer.render(controller.getState());

    const input = host.querySelector<HTMLInputElement>(".cp-input");
    const option = host.querySelector<HTMLButtonElement>('[data-command-palette-option-id="command:first"]');
    expect(input).not.toBeNull();
    expect(option).not.toBeNull();

    const backwardTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
      bubbles: true,
    });
    input?.dispatchEvent(backwardTab);

    expect(backwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(option);

    const forwardTab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, bubbles: true });
    option?.dispatchEvent(forwardTab);

    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    renderer.destroy();
    controller.destroy();
  });
});
