import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { StudioController } from "./controller.ts";

/**
 * Lit ReactiveController that re-renders its host whenever the studio state changes.
 * Usage: `private readonly studio = new StudioBinding(this, controller)`.
 */
export class StudioBinding implements ReactiveController {
  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly host: ReactiveControllerHost,
    readonly controller: StudioController,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.unsubscribe = this.controller.subscribe(() => this.host.requestUpdate());
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
  }
}
