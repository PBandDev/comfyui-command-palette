import { describe, expect, it, vi } from "vitest";
import { PaletteController } from "../../src/palette/controller";
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

describe("PaletteController", () => {
  it("can register one result, open/close, and destroy", () => {
    const controller = new PaletteController();

    controller.registerResults([makeResult("command:zoomToFit", "Zoom to Fit")]);

    controller.open();
    expect(controller.getState().open).toBe(true);
    expect(controller.getState().options).toHaveLength(1);

    controller.close();
    expect(controller.getState().open).toBe(false);

    controller.destroy();
  });

  it("chooses the first active result after register and open", () => {
    const controller = new PaletteController();

    controller.registerResults([makeResult("command:first", "First"), makeResult("command:second", "Second")]);
    controller.open();

    expect(controller.getState().activeId).toBe("command:first");
    expect(controller.getState().activeIndex).toBe(0);

    controller.destroy();
  });

  it("moves the active result down and up", () => {
    const controller = new PaletteController();

    controller.registerResults([makeResult("command:first", "First"), makeResult("command:second", "Second")]);
    controller.open();

    controller.navigateDown();
    expect(controller.getState().activeId).toBe("command:second");

    controller.navigateUp();
    expect(controller.getState().activeId).toBe("command:first");

    controller.destroy();
  });

  it("does not own the global Ctrl+K shortcut", () => {
    const controller = new PaletteController();

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      }),
    );

    expect(controller.getState().open).toBe(false);

    controller.destroy();
  });

  it("selectActive emits one selected result without double-running the action", () => {
    const execute = vi.fn();
    const selected = vi.fn();
    const controller = new PaletteController();
    const result = { ...makeResult("command:first", "First"), execute };

    controller.registerResults([result]);
    controller.open();
    controller.onSelect((selectedResult) => {
      selected(selectedResult.id);
      selectedResult.execute();
    });

    controller.selectActive();

    expect(selected).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledWith("command:first");
    expect(execute).toHaveBeenCalledOnce();

    controller.destroy();
  });
});
