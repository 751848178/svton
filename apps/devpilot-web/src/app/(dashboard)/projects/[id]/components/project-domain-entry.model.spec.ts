import { describe, expect, it } from 'vitest';
import type { Site } from '@/app/(dashboard)/sites/types';
import {
  domainAliases,
  domainEvidence,
  domainTarget,
  tlsLabel,
} from './project-domain-entry.model';

const base = {
  id: 'site-1',
  name: 'Web',
  primaryDomain: 'app.example.com',
  aliases: ['www.example.com'],
  runtimeType: 'docker',
  runtimeConfig: {
    upstreamUrl: 'http://127.0.0.1:3000',
    containerName: 'web',
    containerPort: 3000,
  },
  tls: {
    enabled: true,
    status: 'valid',
    probe: { status: 'valid', checkedAt: '2026-08-27T10:00:00Z' },
  },
  accessPolicy: null,
  status: 'active',
  lastSyncAt: null,
  syncError: null,
  createdAt: '2026-08-27T09:00:00Z',
} satisfies Site;

describe('project domain entry model', () => {
  it('keeps aliases and renders the configured runtime target', () => {
    expect(domainAliases(base)).toEqual(['www.example.com']);
    expect(domainTarget(base)).toEqual({
      primary: 'web:3000',
      secondary: 'http://127.0.0.1:3000',
    });
  });

  it('uses only persisted probe evidence and does not invent a passing state', () => {
    expect(domainEvidence(base)).toEqual({
      dnsStatus: null,
      dnsCheckedAt: null,
      probeStatus: 'valid',
      probeCheckedAt: '2026-08-27T10:00:00Z',
    });
    expect(tlsLabel(base)).toBe('valid');
  });
});
