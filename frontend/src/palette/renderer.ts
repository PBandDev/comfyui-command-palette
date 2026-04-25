import type { CommandOption, CommandState } from "kmenu";
import { parsePaletteQuery } from "./query";
import type { PaletteResult } from "./types";

import styles from "./styles.css?inline";

type PaletteCommandState = CommandState<PaletteResult>;

type PaletteCommandOption = CommandOption<PaletteResult>;

export type PaletteRendererCallbacks = {
  readonly onInput: (value: string) => void;
  readonly onClose: () => void;
  readonly onExecute: (result: PaletteResult) => void | Promise<void>;
  readonly onNavigateDown: () => void;
  readonly onNavigateUp: () => void;
};

type RenderedResult = {
  readonly option: PaletteCommandOption;
  readonly optionId: string;
  readonly result: PaletteResult;
};

const RESULTS_LISTBOX_ID = "command-palette-results";
const OPTION_ID_PREFIX = "command-palette-option-";

export class PaletteRenderer {
  private styleEl: HTMLStyleElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private dialogEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private listEl: HTMLUListElement | null = null;
  private renderedResults: readonly RenderedResult[] = [];
  private activeId: string | undefined;
  private previouslyFocusedEl: HTMLElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: PaletteRendererCallbacks,
  ) {
    this.ensureStyles();
  }

  render(state: PaletteCommandState): void {
    if (!state.open) {
      this.teardownDialog();
      return;
    }

    this.ensureDialog();
    this.activeId = state.activeId;
    this.renderInput(state);
    this.renderHints(state);
    this.renderResults(state.filtered);

    // Focus after the DOM exists.
    this.inputEl?.focus();
  }

  destroy(): void {
    this.teardownDialog();
    this.styleEl?.remove();
    this.styleEl = null;
  }

  private ensureStyles(): void {
    if (this.styleEl !== null) {
      return;
    }

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-command-palette", "styles");
    styleEl.textContent = styles;
    this.host.append(styleEl);
    this.styleEl = styleEl;
  }

  private ensureDialog(): void {
    if (this.overlayEl !== null && this.dialogEl !== null) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "cp-overlay";
    overlay.setAttribute("data-command-palette", "overlay");
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.callbacks.onClose();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "cp-dialog";
    dialog.setAttribute("data-command-palette", "dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "ComfyUI command palette");
    dialog.addEventListener("keydown", (event) => {
      this.handleDialogKeydown(event);
    });

    const header = document.createElement("div");
    header.className = "cp-header";

    const input = document.createElement("input");
    input.className = "cp-input";
    input.type = "text";
    input.placeholder = "Search...";
    input.setAttribute("aria-label", "Search ComfyUI commands");
    input.setAttribute("aria-controls", RESULTS_LISTBOX_ID);
    input.addEventListener("input", () => {
      this.callbacks.onInput(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.callbacks.onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.callbacks.onNavigateDown();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.callbacks.onNavigateUp();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        this.executeActiveOrFirst();
      }
    });

    const hints = document.createElement("div");
    hints.className = "cp-hints";
    hints.setAttribute("data-command-palette", "hints");

    const list = document.createElement("ul");
    list.id = RESULTS_LISTBOX_ID;
    list.className = "cp-results";
    list.setAttribute("data-command-palette", "results");
    list.setAttribute("role", "listbox");

    header.append(input, hints);
    dialog.append(header, list);
    overlay.append(dialog);

    const activeElement = document.activeElement;
    this.previouslyFocusedEl = activeElement instanceof HTMLElement ? activeElement : null;

    this.host.append(overlay);

    this.overlayEl = overlay;
    this.dialogEl = dialog;
    this.inputEl = input;
    this.listEl = list;
  }

  private teardownDialog(): void {
    const previouslyFocusedEl = this.previouslyFocusedEl;
    this.overlayEl?.remove();
    this.overlayEl = null;
    this.dialogEl = null;
    this.inputEl = null;
    this.listEl = null;
    this.renderedResults = [];
    this.activeId = undefined;
    this.previouslyFocusedEl = null;

    if (previouslyFocusedEl?.isConnected === true) {
      previouslyFocusedEl.focus();
    }
  }

  private renderInput(state: PaletteCommandState): void {
    if (this.inputEl === null) {
      return;
    }

    if (this.inputEl.value !== state.input) {
      this.inputEl.value = state.input;
    }

    if (this.activeId === undefined) {
      this.inputEl.removeAttribute("aria-activedescendant");
      return;
    }

    this.inputEl.setAttribute("aria-activedescendant", optionElementId(this.activeId));
  }

  private renderHints(state: PaletteCommandState): void {
    const hints = this.dialogEl?.querySelector('[data-command-palette="hints"]');
    if (hints === null || hints === undefined) {
      return;
    }

    const parsed = parsePaletteQuery(state.input);
    const activePrefix = parsed.prefix;

    hints.replaceChildren(
      hintItem("All", "no prefix", activePrefix === "all"),
      hintItem("Commands", ">", activePrefix === "commands"),
      hintItem("Graph Nodes", "@", activePrefix === "graphNodes"),
      hintItem("Add Nodes", "+", activePrefix === "addNodes"),
      hintItem("Workflows", "#", activePrefix === "workflows"),
      hintItem("Help", "?", activePrefix === "help"),
      hintItem("Close", "Esc", false),
    );
  }

  private renderResults(options: readonly PaletteCommandOption[]): void {
    if (this.listEl === null) {
      return;
    }

    const results = options.flatMap((option) => {
      const optionId = option.id;
      const result = option.data;
      if (optionId === undefined || result === undefined) {
        return [];
      }

      return [{ option, optionId, result }] as const;
    });
    this.renderedResults = results;

    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cp-empty";
      empty.textContent = "No results";
      this.listEl.replaceChildren(empty);
      return;
    }

    const rows = results.map(({ option, optionId, result }) => this.renderRow(option, optionId, result));
    this.listEl.replaceChildren(...rows);
    this.scrollActiveOptionIntoView();
  }

  private renderRow(option: PaletteCommandOption, optionId: string, result: PaletteResult): HTMLLIElement {
    const li = document.createElement("li");
    li.setAttribute("role", "none");

    const button = document.createElement("button");
    const disabled = option.disabled === true;
    const active = optionId === this.activeId;
    button.type = "button";
    button.id = optionElementId(optionId);
    button.className = active ? "cp-row cp-row-active" : "cp-row";
    button.disabled = disabled;
    button.setAttribute("data-command-palette-option-id", optionId);
    button.setAttribute("data-command-palette-active", String(active));
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("aria-disabled", String(disabled));
    button.addEventListener("click", async () => {
      if (disabled) {
        return;
      }

      await this.callbacks.onExecute(result);
    });

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "cp-title";
    title.textContent = result.title;
    left.append(title);

    if (result.subtitle !== undefined) {
      const subtitle = document.createElement("div");
      subtitle.className = "cp-subtitle";
      subtitle.textContent = result.subtitle;
      left.append(subtitle);
    }

    const right = document.createElement("div");
    right.className = "cp-shortcut";
    right.textContent = result.shortcut ?? "";

    button.append(left, right);
    li.append(button);

    return li;
  }

  private scrollActiveOptionIntoView(): void {
    if (this.activeId === undefined || this.listEl === null) {
      return;
    }

    const activeOption = this.listEl.querySelector<HTMLElement>('[data-command-palette-active="true"]');
    if (activeOption?.scrollIntoView === undefined) {
      return;
    }

    activeOption.scrollIntoView({ block: "nearest" });
  }

  private executeActiveOrFirst(): void {
    const selected =
      this.renderedResults.find(({ optionId }) => optionId === this.activeId) ?? this.renderedResults[0];

    if (selected === undefined || selected.option.disabled === true) {
      return;
    }

    void this.callbacks.onExecute(selected.result);
  }

  private handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab") {
      return;
    }

    const dialog = this.dialogEl;

    if (dialog === null) {
      return;
    }

    const focusableEls = focusableElements(dialog);

    if (focusableEls.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === first || !dialog.contains(activeElement)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (activeElement === last || !dialog.contains(activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }
}

function hintItem(label: string, key: string, active: boolean): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "cp-hint";
  span.style.opacity = active ? "1" : "0.85";
  span.textContent = `${label} `;

  const kbd = document.createElement("kbd");
  kbd.textContent = key;
  span.append(kbd);

  return span;
}

function optionElementId(optionId: string): string {
  return `${OPTION_ID_PREFIX}${optionId}`;
}

function focusableElements(root: HTMLElement): readonly HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  return Array.from(root.querySelectorAll(selector)).flatMap((element): readonly HTMLElement[] => {
    if (!(element instanceof HTMLElement)) {
      return [];
    }

    return element.tabIndex >= 0 ? [element] : [];
  });
}
