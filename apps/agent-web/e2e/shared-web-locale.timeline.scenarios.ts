import type { Page } from '@playwright/test';
import type { BrowserDiagnostics, EvidenceRecord } from './shared-web-locale.evidence';
import { runTimelineExecutionScenarios } from './shared-web-locale.timeline-execution.scenarios';
import { runTimelineFileScenarios } from './shared-web-locale.timeline-file.scenarios';
import type { TimelineLabels } from './shared-web-locale.timeline.support';

export async function runTimelineScenarios(
  page: Page,
  labels: TimelineLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  return [
    ...await runTimelineExecutionScenarios(page, labels, diagnostics),
    ...await runTimelineFileScenarios(page, labels, diagnostics),
  ];
}
