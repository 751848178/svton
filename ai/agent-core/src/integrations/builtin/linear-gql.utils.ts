export function escapeLinearGql(value: string): string {
  return value.replace(/["\\\n\r]/g, (char) => {
    switch (char) {
      case '"': return '\\"';
      case '\\': return '\\\\';
      case '\n': return '\\n';
      case '\r': return '\\r';
      default: return char;
    }
  });
}
