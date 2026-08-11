import { spawn } from "node:child_process";

const MAX_OUTPUT = 10 * 1024 * 1024;

export function runExternalOciCommand(
  executable: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return Promise.reject(canceled());
  return new Promise<{ stdout: Buffer }>((resolve, reject) => {
    if (signal?.aborted) { reject(canceled()); return; }
    const child = spawn(executable, args, { shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8" } });
    const stdout: Buffer[] = []; const stderr: Buffer[] = [];
    let bytes = 0; let done = false; let timer: NodeJS.Timeout | undefined;
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) finish(new Error("OCI launcher output limit exceeded"));
      else target.push(chunk);
    };
    const onCanceled = () => finish(canceled());
    const finish = (error?: Error) => {
      if (done) return; done = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onCanceled); child.kill("SIGKILL");
      if (error) reject(error); else resolve({ stdout: Buffer.concat(stdout) });
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", finish);
    child.once("close", (code) => code === 0 ? finish() :
      finish(new Error(`OCI launcher command failed: ${Buffer.concat(stderr)
        .toString("utf8").slice(0, 500)}`)));
    timer = setTimeout(() => finish(new Error("OCI launcher command timed out")), timeoutMs);
    signal?.addEventListener("abort", onCanceled, { once: true });
    if (signal?.aborted) onCanceled();
  });
}

function canceled() { return new Error("OCI launcher command canceled"); }
