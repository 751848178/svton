import { ServerService } from "../../server/server.service";
import { SshCancellationSignal } from "../../common/ssh/ssh-transport";
import { SshTransportFactory } from "../../common/ssh/ssh-transport.factory";
import { ServerExecutionInput } from "../server-executor.types";
import { resolveSshLiveTimeoutMs } from "./ssh-live-config.utils";
import {
  readSshLiveRemoteProcessPid,
  buildSshLiveRemoteWrappedScript,
  stripSshLiveRemoteControlMarkers,
} from "./ssh-live-script.utils";
import { SshCommandResult } from "./ssh-live.types";
import {
  killSshRemoteProcessTree,
  toSshTransportCredentials,
} from "./ssh-live-transport.utils";
import {
  notifySshRemoteProcessCleanup,
  notifySshRemoteProcessStarted,
} from "./ssh-live-runtime-observer.utils";

type SshLiveRunnerOptions = {
  input: ServerExecutionInput;
  credentials: Awaited<ReturnType<ServerService["getDecryptedCredentials"]>>;
  sshTransportFactory: SshTransportFactory;
  remoteKillTimeoutMs: number;
};

export async function runSshLiveScript({
  input,
  credentials,
  sshTransportFactory,
  remoteKillTimeoutMs,
}: SshLiveRunnerOptions): Promise<SshCommandResult> {
  const transport = sshTransportFactory.create(
    toSshTransportCredentials(credentials),
  );
  const script = buildSshLiveRemoteWrappedScript(input);
  const timeoutMs = resolveSshLiveTimeoutMs(input);
  let remoteProcessPid: number | undefined;
  let remoteProcessReported = false;
  let stopReason: "cancel" | "timeout" | undefined;
  let remoteKill: SshCommandResult["remoteKill"];
  let remoteKillPromise: Promise<void> | undefined;
  let remoteProcessStartPromise: Promise<void> | undefined;
  let latestOutput = "";

  const updateRemoteProcessPid = () => {
    remoteProcessPid =
      readSshLiveRemoteProcessPid(latestOutput) ?? remoteProcessPid;
    if (!remoteProcessPid || remoteProcessReported) return;
    remoteProcessReported = true;
    remoteProcessStartPromise = notifySshRemoteProcessStarted(
      input,
      remoteProcessPid,
    );
  };

  const triggerRemoteKill = (reason: "cancel" | "timeout") => {
    stopReason = reason;
    updateRemoteProcessPid();
    if (!remoteProcessPid || remoteKillPromise) return;
    remoteKill = { attempted: true, reason };
    remoteKillPromise = killSshRemoteProcessTree(
      transport,
      remoteProcessPid,
      remoteKillTimeoutMs,
    )
      .then(() => {
        remoteKill = { attempted: true, reason, succeeded: true };
      })
      .catch((error) => {
        remoteKill = {
          attempted: true,
          reason,
          succeeded: false,
          error:
            error instanceof Error ? error.message : "remote cleanup failed",
        };
      });
  };

  const signal = toTransportSignal({
    isCancellationRequested: () =>
      input.cancellationToken?.isCancellationRequested() ?? false,
    onCancel: (cb) =>
      input.cancellationToken?.onCancel(cb) ?? (() => undefined),
  });
  if (signal?.aborted) triggerRemoteKill("cancel");
  const unsubscribeCancel = signal?.onAbort(() => triggerRemoteKill("cancel"));

  try {
    const result = await transport.execScript(script, {
      timeoutMs,
      signal,
      onData: (chunk) => {
        if (chunk.stdout) latestOutput += chunk.stdout;
        if (chunk.stderr) latestOutput += `${chunk.stderr}\n`;
        updateRemoteProcessPid();
        if (stopReason) triggerRemoteKill(stopReason);
      },
    });

    if (result.timedOut) triggerRemoteKill("timeout");
    updateRemoteProcessPid();
    if (remoteKillPromise) {
      await remoteKillPromise;
    } else if (stopReason) {
      remoteKill = {
        attempted: false,
        reason: stopReason,
        error: "remote process pid was not observed before ssh session exited",
      };
    }
    if (remoteProcessStartPromise) await remoteProcessStartPromise;
    if (remoteKill) {
      await notifySshRemoteProcessCleanup(input, remoteKill, remoteProcessPid);
    }

    return {
      exitCode: result.exitCode,
      stdout: stripSshLiveRemoteControlMarkers(result.stdout),
      stderr: stripSshLiveRemoteControlMarkers(result.stderr),
      timedOut: result.timedOut,
      cancelled: result.cancelled,
      remoteProcessPid,
      remoteKill,
    };
  } finally {
    unsubscribeCancel?.();
    transport.dispose?.();
  }
}

function toTransportSignal(token?: {
  isCancellationRequested(): boolean;
  onCancel(cb: () => void): () => void;
}): SshCancellationSignal | undefined {
  if (!token) return undefined;
  return {
    get aborted() {
      return token.isCancellationRequested();
    },
    onAbort(callback: () => void) {
      if (token.isCancellationRequested()) {
        callback();
        return () => undefined;
      }
      return token.onCancel(callback);
    },
  };
}
