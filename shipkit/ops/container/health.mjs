// Probe both child processes through the same API route used by the browser.
try {
  for (const url of ['http://127.0.0.1:8770/api/health', 'http://127.0.0.1:8769/api/health']) {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('unhealthy');
  }
} catch { process.exitCode = 1; }
