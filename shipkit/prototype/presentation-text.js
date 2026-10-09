// Format display text without changing stored events or lifecycle state.
export function presentationText(value) {
  return String(value ?? '')
    .replace(/\[演示\]\s*/g,'').replace(/模拟|演示/g,'')
    .replace(/\bdemo-(?=release-|rollback-|builder-|registry\.invalid\b|web\b|v\d+\b)/g,'')
    .replace(/\bdemo001\b/g,'001').replace(/\b(web|api)-demo\b/g,'$1');
}
