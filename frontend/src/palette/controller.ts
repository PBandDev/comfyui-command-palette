import { CommandCore } from "kmenu";
import type { CommandEvent, CommandOption, CommandState, Unsubscribe } from "kmenu";
import type { PaletteResult } from "./types";

type PaletteCommandState = CommandState<PaletteResult>;

type PaletteOption = CommandOption<PaletteResult>;

type KeyboardEventHandler = (event: KeyboardEvent) => void;

export class PaletteController {
  private readonly core: CommandCore<PaletteResult>;

  constructor() {
    const core = new CommandCore<PaletteResult>({
      // ProviderRegistry already returns filtered results; kmenu filtering would be redundant.
      filter: (options) => options,
    });
    const globalKeyHandler = Reflect.get(core, "globalKeyHandler") as KeyboardEventHandler | undefined;

    if (globalKeyHandler !== undefined) {
      window.removeEventListener("keydown", globalKeyHandler);
    }

    this.core = core;
  }

  open(): void {
    this.core.open();
  }

  close(): void {
    this.core.close();
  }

  toggle(): void {
    this.core.toggle();
  }

  setInput(value: string): void {
    this.core.setInput(value);
  }

  navigateDown(): void {
    this.core.navigateDown();
  }

  navigateUp(): void {
    this.core.navigateUp();
  }

  selectActive(): void {
    this.core.selectActive();
  }

  registerResults(results: readonly PaletteResult[]): void {
    const options = results.map((result): PaletteOption => {
      const disabled = result.disabledReason !== undefined;

      return {
        id: result.id,
        label: result.title,
        keywords: [...result.keywords],
        disabled,
        group: result.group,
        data: result,
      };
    });

    this.core.registerOptions(options);
  }

  getState(): PaletteCommandState {
    return this.core.getState();
  }

  onChange(handler: (input: string) => void): Unsubscribe {
    return this.core.on("change", (event: CommandEvent<PaletteResult>) => {
      if (event.type !== "change") {
        return;
      }

      handler(event.input);
    });
  }

  onSelect(handler: (result: PaletteResult) => void | Promise<void>): Unsubscribe {
    return this.core.on("select", async (event: CommandEvent<PaletteResult>) => {
      if (event.type !== "select") {
        return;
      }

      const result = event.option.data;
      if (result !== undefined) {
        await handler(result);
      }
    });
  }

  destroy(): void {
    this.core.destroy();
  }
}
