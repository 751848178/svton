import { describe, expect, it } from 'vitest';
import { timelineEnCatalog } from '../src/i18n/catalogs/timeline.en';
import { timelineZhCatalog } from '../src/i18n/catalogs/timeline.zh';

describe('timeline catalog contract', () => {
  it('keeps exactly 39 paired keys and interpolation tokens', () => {
    const enKeys = Object.keys(timelineEnCatalog).sort();
    const zhKeys = Object.keys(timelineZhCatalog).sort();
    expect(enKeys).toHaveLength(39);
    expect(zhKeys).toEqual(enKeys);
    const tokens = (value: string) => [...value.matchAll(/\{([^{}]+)\}/g)]
      .map((match) => match[1]).sort();
    for (const key of enKeys) {
      expect(tokens(timelineZhCatalog[key as keyof typeof timelineZhCatalog]), key)
        .toEqual(tokens(timelineEnCatalog[key as keyof typeof timelineEnCatalog]));
    }
  });

  it('retains exact host and payload-boundary wording', () => {
    expect(timelineEnCatalog['timeline.unavailable.openPathTitle'])
      .toBe('Opening paths is unavailable in this host');
    expect(timelineZhCatalog['timeline.unavailable.openPathTitle'])
      .toBe('当前客户端无法打开路径');
    expect(timelineEnCatalog['timeline.title.tool']).toBe('{tool} {status}');
    expect(timelineZhCatalog['timeline.title.tool']).toBe('{tool}：{status}');
  });
});
