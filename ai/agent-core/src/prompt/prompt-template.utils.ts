export function buildTemplateVariablePattern(key: string): RegExp {
  const literalKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\{\\{${literalKey}\\}\\}`, 'g');
}
