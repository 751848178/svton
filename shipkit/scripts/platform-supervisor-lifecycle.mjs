import { platformProcessStopped, stopPlatformProcesses } from './platform-process-tree.mjs';

// Serialize lease ownership and process admission across asynchronous startup.
export function platformSupervisorLifecycle() {
  let stopping = false, releaseLock, stopPromise;
  const running = new Set();
  return {
    get stopping() { return stopping; },
    async acquire(acquire) {
      const release = await acquire();
      if (stopping) {
        if (await stopPromise) release();
        else releaseLock = release;
        throw new Error('Platform startup was stopped');
      }
      releaseLock = release;
    },
    async launch(openLog, spawnChild) {
      if (stopping) throw new Error('Platform startup was stopped');
      const file = await openLog();
      if (stopping) { await file.close(); throw new Error('Platform startup was stopped'); }
      let child;
      try { child = spawnChild(file); }
      catch (error) { await file.close(); throw error; }
      running.add(child);
      child.once('close', () => {
        void file.close();
        if (platformProcessStopped(child)) running.delete(child);
      });
      return child;
    },
    completed(child) { if (platformProcessStopped(child)) running.delete(child); },
    stop() {
      stopping = true;
      stopPromise ??= (async () => {
        const stopped = await stopPlatformProcesses([...running]);
        if (stopped) { releaseLock?.(); releaseLock = undefined; }
        return stopped;
      })();
      return stopPromise;
    },
  };
}
