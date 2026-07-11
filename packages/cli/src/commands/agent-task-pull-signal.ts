export type AgentTaskPullStopController = {
  signal: AbortSignal;
  cleanup: () => void;
};

type SignalProcessLike = {
  on: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
  off: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
};

export function createAgentTaskPullStopController(
  processLike: SignalProcessLike = process,
): AgentTaskPullStopController {
  const controller = new AbortController();
  const stop = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  processLike.on("SIGINT", stop);
  processLike.on("SIGTERM", stop);

  return {
    signal: controller.signal,
    cleanup: () => {
      processLike.off("SIGINT", stop);
      processLike.off("SIGTERM", stop);
    },
  };
}
