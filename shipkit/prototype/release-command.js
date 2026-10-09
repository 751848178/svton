export function releaseCommand(project, selected) {
  const entry=project.id==='twgg'?'sh scripts/shipkit/release.sh':'ship release';
  return `${entry} --services ${selected.join(',')} --json`;
}
