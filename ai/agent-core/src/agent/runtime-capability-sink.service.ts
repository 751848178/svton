import type { SvtonCapabilityEvent } from './types';
import type { ToolEventSink } from './pi-tool-adapter';

/** Owns the capability sink leased to the currently active runtime run. */
export class RuntimeCapabilitySinkService {
  private activeSink: ToolEventSink | null = null;

  acquire(sink: ToolEventSink): () => void {
    this.activeSink = sink;
    return () => {
      if (this.activeSink === sink) this.activeSink = null;
    };
  }

  route(event: SvtonCapabilityEvent): void {
    this.activeSink?.(event);
  }

  reset(): void {
    this.activeSink = null;
  }
}
