import type { StageKey, TaskDetail } from '@/lib/contracts';
import { stageLabels, time } from '@/lib/presentation';
import { activityMessages, inLogScope, latestLogStages, logStages } from '@/lib/stage-log-activity';
import { stageState } from '@/lib/task-state';
import { Status } from './primitives';
import { hasEvidence } from '@/lib/log-evidence-fields';
import { StageResultEvidence } from './stage-result-evidence';
import { RemoteLogEvidence } from './remote-log-evidence';

export function StageLogEvidence({ detail, stage, service }: { detail: TaskDetail; stage: StageKey; service: string }) {
  const stages = logStages(detail, stage, service);
  const activity = latestLogStages(stages);
  const events = detail.events.filter(event => inLogScope(event, stage, service));
  const jobs = detail.remoteJobs.filter(job => inLogScope(job, stage, service));
  const messages = activityMessages(events);
  const results = stages.filter(value => hasEvidence(value.detail));
  return <>
    {(activity.length > 0 || messages.length > 0) && <section className="log-activity" aria-label="阶段状态与诊断">
      <h3>阶段状态与诊断</h3>
      <ul>{activity.map(value => {
        const relevant = stages.filter(row => !row.serviceKey || row.serviceKey === value.serviceKey);
        const state = stageState(relevant, stage);
        return <li key={value.serviceKey || 'stage'}><span>{value.serviceKey || stageLabels[stage]}</span><time>{time(value.updatedAt || value.finishedAt || value.startedAt)}</time><Status value={state.status} label={state.label} /></li>;
      })}</ul>
      {messages.map(event => <p className="log-diagnostic" key={event.seq}><time>{time(event.createdAt)}</time> {event.serviceKey ? `${event.serviceKey} · ` : ''}{event.message}{event.occurrences > 1 ? `（重复 ${event.occurrences} 次，已合并）` : ''}</p>)}
    </section>}
    <StageResultEvidence results={results} />
    <RemoteLogEvidence jobs={jobs} events={events} />
  </>;
}
