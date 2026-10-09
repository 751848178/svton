'use client';
import type { ReleaseController } from '@/hooks/use-release';
import { isBusy } from '@/lib/presentation';

const steps = [['选择服务', '确定本次发布范围'], ['核对计划', '确认更新与继承'], ['执行发布', '手动开始与实时日志'], ['查看结果', '确认应用与资源状态']];
export function ReleaseStepper({ control, onStep }: { control: ReleaseController; onStep: (step: number) => void }) {
  const available = [true, !!control.plan, !!control.plan || !!control.task, !!control.task && !isBusy(control.task)];
  return <><ol className="stepper devpilot-steps" aria-label="发布步骤">{steps.map(([title, description], index) => {
    const number = index + 1;
    const disabled = control.busy || !available[index];
    return <li key={title} className={`step-item ${number === control.step ? 'is-active' : number < control.step ? 'is-complete' : 'is-future'}`}><button className="step-link" onClick={() => onStep(number)} disabled={disabled} aria-current={number === control.step ? 'step' : undefined} title={!available[index] ? index === 3 ? '本次任务结束后开放' : '先生成发布计划' : control.busy ? '执行期间不能切换步骤' : undefined}><span className="step-label">{title}</span><span className="step-description">{description}</span></button></li>;
  })}</ol><p className="subtle step-guidance">{control.busy ? '任务进行中，导航已锁定；取消需等待远端确认。' : control.task ? '可点击各步骤回看已保存的服务范围与计划；开始新发布会创建独立任务。' : '点击步骤名称切换；查看结果将在本次执行结束后开放。'}</p></>;
}
