import React from 'react';
import { headers } from 'next/headers';
import { afterEach, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

import RootLayout from '../src/app/layout';
import { resolveWebLocale as resolveStaticLocale } from '../src/lib/locale/web-locale-host.static';

const mockedHeaders = vi.mocked(headers);

function layoutContract(element: React.ReactElement) {
  const children = React.Children.toArray(element.props.children) as React.ReactElement[];
  const body = children.find((child) => child.type === 'body');
  const provider = React.Children.only(body?.props.children) as React.ReactElement<{ locale: string }>;
  return { htmlLang: element.props.lang as string, providerLocale: provider.props.locale };
}

describe('Web locale bootstrap', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SVTON_STATIC_EXPORT_LOCALE;
  });

  it('awaits one request header owner and binds html/provider to one locale', async () => {
    mockedHeaders.mockResolvedValue(new Headers({ 'accept-language': 'zh-CN,en;q=0.5' }) as never);
    const layout = await RootLayout({ children: <p>child</p> });
    expect(layoutContract(layout)).toEqual({ htmlLang: 'zh-CN', providerLocale: 'zh' });
    expect(mockedHeaders).toHaveBeenCalledOnce();
  });

  it('keeps 24 parallel opposite-language requests isolated', async () => {
    mockedHeaders.mockImplementation(() => {
      const index = mockedHeaders.mock.calls.length - 1;
      const language = index % 2 === 0 ? 'zh-CN' : 'en-US';
      return Promise.resolve(new Headers({ 'accept-language': language })) as never;
    });
    const layouts = await Promise.all(Array.from({ length: 24 }, () => (
      RootLayout({ children: <p>child</p> })
    )));
    layouts.forEach((layout, index) => {
      expect(layoutContract(layout)).toEqual(index % 2 === 0
        ? { htmlLang: 'zh-CN', providerLocale: 'zh' }
        : { htmlLang: 'en', providerLocale: 'en' });
    });
    expect(mockedHeaders).toHaveBeenCalledTimes(24);
  });

  it.each(['zh', 'en'] as const)('uses a fixed %s locale in static mode', async (locale) => {
    process.env.SVTON_STATIC_EXPORT_LOCALE = locale;
    await expect(resolveStaticLocale()).resolves.toBe(locale);
    expect(mockedHeaders).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid fixed static locale clearly', async () => {
    await expect(resolveStaticLocale()).rejects.toThrow('Static locale was not validated');
    process.env.SVTON_STATIC_EXPORT_LOCALE = 'fr';
    await expect(resolveStaticLocale()).rejects.toThrow('Static locale was not validated');
  });
});
