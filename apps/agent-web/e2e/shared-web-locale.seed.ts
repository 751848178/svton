export const resultFixture = {
  controllerFile: '动态-controller.txt',
  imageFile: '动态-image.png',
  changePath: '/动态/project/src/exact.ts',
  createdPath: '/dynamic/project/src/created.ts',
  treePath: '/动态/tree/exact-tree.ts',
  referenceLine: 42,
  diff: '+动态-diff-byte\n-old-byte',
  documentTitle: '动态-document-title',
  documentSnippet: 'byte-snippet-保持原样',
} as const;

/** Deterministic provider input; production document detection receives the raw text. */
export function buildResultDocumentFixture(): string {
  return [
    `# ${resultFixture.documentTitle}`, '', resultFixture.documentSnippet, '',
    '## Section one', ...Array.from({ length: 12 }, (_, index) => `line-one-${index} dynamic`),
    '## Section two', ...Array.from({ length: 12 }, (_, index) => `line-two-${index} dynamic`),
    '## Section three', ...Array.from({ length: 12 }, (_, index) => `line-three-${index} dynamic`),
  ].join('\n');
}
