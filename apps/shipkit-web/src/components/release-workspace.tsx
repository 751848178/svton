'use client';
import type { LiveProject, Project, TaskDetail } from '@/lib/contracts';
import type { Location } from '@/hooks/use-navigation';
import { useRelease } from '@/hooks/use-release';
import { serverLabel } from '@/lib/presentation';
import { EmptyPanel, ErrorMessage, LoadingPanel, PageHead } from './primitives';
import { ReleaseStepper } from './release-stepper';
import { ReleaseSelection } from './release-selection';
import { ReleasePlanView } from './release-plan';
import { ReleaseExecution } from './release-execution';
import { ReleaseResult } from './release-result';
import { ProjectBreadcrumbs } from './project-breadcrumbs';

interface Props { project: Project; live: LiveProject; location: Location; detail?: TaskDetail; taskLoading: boolean; taskError: unknown; navigate: (next: Partial<Location>) => void; refresh: () => void }
export function ReleaseWorkspace(props: Props) {
  const control = useRelease(props);
  const title = props.detail?.task.version || (props.location.taskId ? '正在读取版本…' : '新发布');
  const onBack = () => props.navigate({ view: props.detail ? 'history' : 'overview', taskId: '', step: 1 });
  return <>
    <ProjectBreadcrumbs project={props.project} current={title} parent={props.location.taskId ? 'history' : undefined} disabled={control.busy} />
    <PageHead title={title} description={`部署目标 ${serverLabel(props.project, props.live)}`} onBack={onBack} backLabel={props.location.taskId ? '返回发布记录' : '返回项目详情'} disabled={control.busy} />
    <ReleaseStepper control={control} onStep={step => props.navigate({ step })} />
    <ErrorMessage error={control.error || props.taskError} />
    {props.location.taskId && props.taskLoading ? <LoadingPanel text="正在从数据库恢复本次任务、计划和阶段日志…" /> : <div className="wizard-body">
      {control.step === 1 && <ReleaseSelection project={props.project} live={props.live} control={control} />}
      {control.step === 2 && control.plan && <ReleasePlanView project={props.project} live={props.live} plan={control.plan} readOnly={control.readOnly} onExecute={() => props.navigate({ step: 3 })} />}
      {control.step === 3 && <ReleaseExecution control={control} live={props.live} detail={props.detail} onNew={() => props.navigate({ taskId: '', step: 1 })} />}
      {control.step === 4 && props.detail ? <ReleaseResult project={props.project} live={props.live} detail={props.detail} onHistory={() => props.navigate({ view: 'history', taskId: '' })} onNew={() => props.navigate({ taskId: '', step: 1 })} onCleanup={control.cleanup} busy={control.action !== null} /> : control.step === 4 && <EmptyPanel text="本次任务尚未完成，结果将在执行结束后开放。" />}
    </div>}
  </>;
}
