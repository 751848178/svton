import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Web responsive artifact adapter', () => {
  it('delegates split ownership to the shared host', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ChatContent.tsx'), 'utf8');
    expect(source).toContain('ResponsiveArtifactHost');
    expect(source).not.toMatch(/md:w-1\/2|ArtifactPanel|ArtifactHostStatus/);
    expect(source.match(/<ResponsiveArtifactHost/g)).toHaveLength(1);
  });
});
