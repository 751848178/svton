/**
 * 创建告警规则弹窗
 *
 * 单一职责：收集规则字段并提交 useMonitoring.createRule。
 * 字段对齐后端 CreateAlertRuleDto：name/category/metric/severity/condition/enabled
 * + 目标资源(server/site/project)+ 评估模式(schedule 自动 / manual 手动)。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ErrorBanner, Modal } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { ModalFormFooter } from './modal-form-fields';
import { CreateRuleFormFields } from './create-rule-form-fields';

export interface TargetOption {
  id: string;
  name: string;
}

export interface CreateRuleFormValues {
  name: string;
  category: string;
  metric: string;
  severity: string;
  thresholdDays: string;
  condition: string;
  enabled: boolean;
  evaluationMode: 'manual' | 'schedule';
  intervalSeconds: string;
  targetId: string;
}

interface CreateRuleModalProps {
  open: boolean;
  creating: boolean;
  error: string;
  onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
  /** 按 category 预分组的目标资源选项;仅相应类别会渲染目标选择器。 */
  targetsByCategory?: Record<string, TargetOption[]>;
}

/** category → 后端目标资源字段名的映射。无映射的类别(如 log/deployment)不渲染目标选择器。 */
const CATEGORY_TARGET_FIELD: Record<string, string> = {
  server: 'serverId',
  site: 'siteId',
  service: 'projectId',
  resource: 'managedResourceId',
  backup: 'backupPlanId',
};

export function CreateRuleModal({
  open,
  creating,
  error,
  onClose,
  onCreate,
  targetsByCategory = {},
}: CreateRuleModalProps) {
  const t = useTranslations('monitoring');
  const { register, handleSubmit, setError, watch, formState, reset } = useForm<CreateRuleFormValues>({
    defaultValues: {
      name: '',
      category: 'service',
      metric: 'service_status',
      severity: 'warning',
      thresholdDays: '',
      condition: '',
      enabled: true,
      evaluationMode: 'schedule',
      intervalSeconds: '',
      targetId: '',
    },
  });

  // 仅 certificate_expiry 提供结构化 thresholdDays 字段；其余指标 thresholdDays 无意义。
  const metric = watch('metric');
  const showThresholdDays = metric === 'certificate_expiry';
  const category = watch('category');
  const evaluationMode = watch('evaluationMode');
  const targetField = CATEGORY_TARGET_FIELD[category];
  const categoryTargets = targetsByCategory[category] ?? [];
  const showTarget = Boolean(targetField) && categoryTargets.length > 0;
  const showInterval = evaluationMode === 'schedule';

  const submit = handleSubmit(async (data) => {
    const body: Record<string, unknown> = {
      name: data.name,
      category: data.category,
      severity: data.severity,
      enabled: data.enabled,
      evaluationMode: data.evaluationMode,
    };
    if (data.metric) body.metric = data.metric;
    // 评估间隔:仅 schedule 模式有效,后端最小 30s。
    if (data.evaluationMode === 'schedule' && data.intervalSeconds.trim() !== '') {
      const intervalSeconds = Number(data.intervalSeconds);
      if (Number.isFinite(intervalSeconds) && intervalSeconds >= 30) {
        body.intervalSeconds = Math.floor(intervalSeconds);
      }
    }
    // 目标资源绑定(按 category 映射到对应字段)。
    if (targetField && data.targetId) {
      body[targetField] = data.targetId;
    }
    // 组装 condition：以结构化 thresholdDays 为准（若有），叠加高级 JSON 编辑。
    let condition: Record<string, unknown> | undefined;
    const conditionText = data.condition.trim();
    if (conditionText) {
      try {
        condition = JSON.parse(conditionText) as Record<string, unknown>;
      } catch {
        setError('root', { message: t('formConditionInvalid') });
        return;
      }
    }
    const thresholdRaw = data.thresholdDays.trim();
    if (thresholdRaw !== '') {
      const thresholdDays = Number(thresholdRaw);
      if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
        setError('root', { message: t('formThresholdDaysInvalid') });
        return;
      }
      condition = { ...(condition ?? {}), thresholdDays };
    }
    if (condition) body.condition = condition;
    const ok = await onCreate(body);
    if (ok) {
      feedback.success(t('ruleCreated'));
      reset();
      onClose();
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createRule')}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <ErrorBanner
          message={error}
          variant="inline"
        />
        {(formState.errors.root as { message?: string } | undefined)?.message ? (
          <ErrorBanner
            message={(formState.errors.root as { message?: string } | undefined)?.message || ''}
            variant="inline"
          />
        ) : null}
        <CreateRuleFormFields
          register={register}
          showTarget={showTarget}
          categoryTargets={categoryTargets}
          showThresholdDays={showThresholdDays}
          showInterval={showInterval}
        />
        <ModalFormFooter
          creating={creating}
          submitting={formState.isSubmitting}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}
