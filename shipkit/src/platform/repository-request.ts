import { request } from 'node:https';
import { resolveGitAddresses } from '../shared/git-policy.js';
import type { RepositoryResolveOptions } from './repository-contracts.js';

export interface RepositoryBudget { deadline: number; remaining: number }
export type RepositoryReader = (url: URL, headers: Record<string, string>) => Promise<Record<string, unknown>>;
export function repositoryReader(options: RepositoryResolveOptions, budget: RepositoryBudget): RepositoryReader {
  return async (url, headers) => {
    const addresses = await resolveGitAddresses(url.hostname, { ...options, dnsTimeoutMs: Math.max(1, budget.deadline - Date.now()) });
    if (Date.now() >= budget.deadline) throw new Error('Repository metadata request timed out');
    const address = addresses.find(item => item.family === 4) ?? addresses[0]!;
    const bytes = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const req = request(url, { method: 'GET', headers, agent: false,
        lookup: (_host, _options, callback) => callback(null, address.address, address.family) }, response => {
        if (response.statusCode !== 200) {
          response.resume(); reject(new Error(response.statusCode === 401 || response.statusCode === 403
            ? 'Repository credentials were rejected or read permission is missing'
            : response.statusCode === 404 ? 'Repository, ref, or definition file does not exist'
              : `Repository metadata request failed (${response.statusCode}); redirects are not followed`)); return;
        }
        response.on('data', (chunk: Buffer) => {
          budget.remaining -= chunk.length;
          if (budget.remaining < 0) req.destroy(new Error('Repository metadata exceeded the configured byte limit'));
          else chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks))); response.on('error', reject);
      });
      const timer = setTimeout(() => req.destroy(new Error('Repository metadata request timed out')), Math.max(1, budget.deadline - Date.now()));
      req.once('close', () => clearTimeout(timer)); req.once('error', reject); req.end();
    });
    let value: unknown; try { value = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Repository provider returned invalid metadata'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Repository provider returned invalid metadata');
    return value as Record<string, unknown>;
  };
}
