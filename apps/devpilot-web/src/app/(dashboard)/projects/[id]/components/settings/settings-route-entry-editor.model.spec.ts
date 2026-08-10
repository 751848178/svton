import { describe, expect, it } from 'vitest';
import {
  initialRouteEntryForm,
  removeRouteEntry,
  routeEntryFormError,
  routeEntryFromForm,
  upsertRouteEntry,
} from './settings-route-entry-editor.model';

const options = [{ serviceId: 'service-web', component: 'web', port: 4173 }];

describe('route entry editor model', () => {
  it('defaults new entries to the first real project component target', () => {
    expect(initialRouteEntryForm(null, options).target).toBe('service-web:4173');
  });

  it.each([
    [{ domain: 'https://bad', path: '/', target: 'service-web:4173' }, 'host'],
    [{ domain: 'app.example.com', path: 'api', target: 'service-web:4173' }, 'path'],
    [{ domain: 'app.example.com', path: '/', target: 'custom' }, 'target'],
  ] as const)('rejects invalid route form %#', (partial, error) => {
    const form = { ...initialRouteEntryForm(null, options), ...partial };
    expect(routeEntryFormError(form, options)).toBe(error);
    expect(routeEntryFromForm(form, options)).toBeNull();
  });

  it('uses domain and normalized path as identity for add, edit and delete', () => {
    const root = entry('app.example.com', '/', 4173);
    const api = entry('app.example.com', '/api', 4310);
    const edited = entry('app.example.com', '/v2/', 4310);

    expect(upsertRouteEntry([root, api], edited, api)).toEqual([root, edited]);
    expect(removeRouteEntry([root, edited], edited)).toEqual([root]);
  });

  it('blocks a new entry that conflicts with an existing normalized domain and path', () => {
    const existing = entry('app.example.com', '/api', 4173);
    const form = {
      ...initialRouteEntryForm(null, options),
      domain: 'APP.EXAMPLE.COM.',
      path: '/api/',
    };

    expect(routeEntryFormError(form, options, [existing])).toBe('conflict');
    expect(routeEntryFromForm(form, options, [existing])).toBeNull();
    expect(() => upsertRouteEntry([existing], existing, null)).toThrow(
      '路由 Host 与 Path 已存在',
    );
  });

  it('allows an edit to keep its own identity but blocks moving onto another entry', () => {
    const root = entry('app.example.com', '/', 4173);
    const api = entry('app.example.com', '/api', 4310);
    const unchanged = {
      ...initialRouteEntryForm(root, options),
      domain: root.domain,
      path: root.path,
    };
    const conflicting = { ...unchanged, path: '/api/' };

    expect(routeEntryFormError(unchanged, options, [root, api], root)).toBeNull();
    expect(routeEntryFormError(conflicting, options, [root, api], root)).toBe('conflict');
    expect(routeEntryFromForm(conflicting, options, [root, api], root)).toBeNull();
  });
});

function entry(domain: string, path: string, port: number) {
  return {
    domain,
    path,
    serviceId: `service-${port}`,
    component: `component-${port}`,
    port,
    tlsMode: 'managed_cert' as const,
  };
}
