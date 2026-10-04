// `ship init` orchestration: resume-aware prefill → app → machines → registry →
// review (masked diff) → conflict-checked atomic write. Failure paths never
// claim a rollback that did not happen, and a failed environment check yields
// "saved but not ready" instead of "initialization complete" (M1-06/M1-10).
// Cancelling keeps every not-yet-reasked answer from the still-valid draft (R4).

import { loadConfig, ConfigError } from '../../shared/config.js';
import { loadSpecFile } from '../../shared/spec-load.js';
import { SpecError } from '../../shared/spec-schema.js';
import type { ShipConfig, ShipSpec } from '../../shared/types.js';
import type { Logger } from '../../shared/log.js';
import path from 'node:path';
import { detectProject } from './detect.js';
import { checkAgent, checkRegistry, type AgentCheckResult, type RegistryCheckResult } from './checks.js';
import { Cancelled, type Prompter, type MissingField } from './prompt.js';
import { readInitState, saveInitState, STATE_SCHEMA_VERSION, type InitState } from './state.js';
import { readCredentials } from '../../shared/credentials.js';
import { fileFingerprint, resolveResume } from './defaults-resume.js';
import { appDefaults, machineDefaults } from './defaults.js';
import { planFileWrites } from './write.js';
import { applyFileWrites, FileConflictError, WriteFailedError } from './apply.js';
import { renderReview, renderNextSteps } from './render.js';
import { askApp, askRegistry } from './questions.js';
import { askMachines } from './machines.js';
import { readiness, appendIgnoreRecheck } from './wizard-support.js';

export type WizardFailReason = 'cancelled' | 'missing-input' | 'no-dockerfile' | 'check-failed' | 'invalid-answers' | 'invalid-existing-file' | 'write-failed' | 'file-conflict';

export interface WizardChecks {
  builder: AgentCheckResult | null;
  runtime: AgentCheckResult | null;
  registry: RegistryCheckResult | null;
}

export type WizardResult =
  | { ok: true; ready: boolean; wrote: string[]; backups: string[]; checks: WizardChecks; next: string[]; warnings: string[]; pending: string[] }
  | { ok: false; reason: WizardFailReason; message: string; missing?: MissingField[]; checks?: WizardChecks };

export interface WizardDeps {
  cwd: string;
  prompter: Prompter;
  log: Logger;
}

const STEP_LABELS: Record<string, string> = { app: '应用信息', machines: '机器接入', registry: '镜像仓库', review: '审阅', done: '已完成' };

function safeLoad<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export async function runWizard(deps: WizardDeps): Promise<WizardResult> {
  const { cwd, prompter: p, log } = deps;
  const det = detectProject(cwd);
  const prior = await readInitState(cwd);
  const resume = await resolveResume(prior, det.existingSpecPath, det.existingConfigPath);
  if (prior && prior.step !== 'done') log.info(`检测到未完成的 init 进度（上次进行到：${STEP_LABELS[prior.step] ?? prior.step}），已答项将作为默认值，可回车确认`);
  if (resume.note) log.info(resume.note);
  const spec: ShipSpec | null = det.existingSpecPath ? safeLoad(() => loadSpecFile(det.existingSpecPath!)) : null;
  const config: ShipConfig | null = det.existingConfigPath ? safeLoad(() => loadConfig(det.existingConfigPath!)) : null;
  if (det.existingSpecPath) log.info(spec ? `已有应用配置：${det.existingSpecPath}` : `已有 ${path.basename(det.existingSpecPath)} 但无法解析：${det.existingSpecPath}`);
  if (det.existingConfigPath) log.info(config ? `已有控制器配置：${det.existingConfigPath}` : `已有控制器配置但无法解析：${det.existingConfigPath}`);
  if (config && config.builder.mode === 'dynamic') log.warn('现有配置使用动态构建机；向导生成 static 构建机配置，审阅差异时会明确显示该变更');
  const fingerprints = { spec: await fileFingerprint(det.existingSpecPath), config: await fileFingerprint(det.existingConfigPath) };
  const stateWarnings: string[] = [];

  const trySave = async (state: InitState): Promise<void> => {
    try {
      await saveInitState(cwd, state);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stateWarnings.push(`进度文件 .ship/init-state.json 写入失败（${msg}）。不影响已写入的配置；恢复进度不可用时删除该文件后重跑 ship init。`);
    }
  };

  if (det.dockerfiles.length === 0) {
    // keep any reusable draft answers — a missing Dockerfile blocks, it does not reset (M1-07)
    await trySave({ schemaVersion: STATE_SCHEMA_VERSION, updatedAt: '', step: 'app', blocked: 'no-dockerfile', files: fingerprints, app: prior?.app, machines: prior?.machines, registry: prior?.registry });
    return {
      ok: false, reason: 'no-dockerfile',
      message: '未找到 Dockerfile。当前向导支持「已有 Dockerfile 的单应用」：请先为项目准备可构建的 Dockerfile（见使用手册第 2 节），然后重新运行 ship init。进度已保存，不会进入假成功状态。',
    };
  }

  // a fresh run keeps the still-valid draft's groups so an early cancel cannot
  // erase answers the user has not been re-asked for yet (R4)
  let progress: InitState = {
    schemaVersion: STATE_SCHEMA_VERSION, updatedAt: '', step: 'app', files: fingerprints,
    app: resume.useApp ? prior?.app : undefined,
    machines: resume.useMachines ? prior?.machines : undefined,
    registry: resume.useRegistry ? prior?.registry : undefined,
  };
  try {
    log.info('步骤 1/4 — 应用');
    const app = await askApp(det, appDefaults(spec, prior, det, resume), p);
    progress = { ...progress, step: 'app', app, blocked: undefined };
    await trySave(progress);

    log.info('步骤 2/4 — 机器（已装 agent：手工填入口，或用管理员生成的一次性配对码接入）');
    // credentials are read once here: machineDefaults resolves tokenRef entries into
    // (url, token, tokenRef, caFile) groups so an unchanged rerun keeps the refs (M2-05)
    const creds = await readCredentials().catch(() => undefined);
    const md = machineDefaults(config, resume.useMachines ? prior : null, creds);
    const machines = await askMachines({
      builderUrl: md.builderUrl, builderToken: md.builderToken,
      builderTokenRef: md.builderTokenRef, builderCaFile: md.builderCaFile,
      targetName: md.targetName, priorRuntimeUrl: md.priorRuntimeUrl,
      runtimeTargets: md.runtimeTargets,
    }, p, log);
    progress = { ...progress, step: 'machines', machines: { builderUrl: machines.builderUrl, targetName: machines.targetName, runtimeUrl: machines.runtimeUrl } };
    await trySave(progress);

    log.info('步骤 3/4 — 镜像仓库');
    const draftRegistry = resume.useRegistry ? prior?.registry : undefined;
    const registry = await askRegistry({
      url: draftRegistry?.url ?? config?.registry?.url,
      namespace: draftRegistry?.namespace ?? config?.registry?.namespace,
    }, p);
    progress = { ...progress, step: 'registry', registry };
    await trySave(progress);

    const missing = p.missing();
    if (missing.length > 0) {
      return { ok: false, reason: 'missing-input', message: `非交互模式缺少 ${missing.length} 项输入（在 TTY 下运行 ship init 可交互补齐；已答项已保存进度）`, missing };
    }

    log.info('步骤 4/4 — 检查与审阅');
    const builderCheck = machines.builderCheck ?? await checkAgent('builder', machines.builderUrl, machines.builderToken, machines.builderCaFile);
    const runtimeCheck = machines.runtimeCheck ?? await checkAgent('runtime', machines.runtimeUrl, machines.runtimeToken, machines.runtimeCaFile);
    const registryCheck = await checkRegistry(registry.url);
    const checks: WizardChecks = { builder: builderCheck, runtime: runtimeCheck, registry: registryCheck };

    if (!p.interactive && !(builderCheck?.passed && runtimeCheck?.passed)) {
      return { ok: false, reason: 'check-failed', message: 'agent 检查未通过（见 checks 明细）；交互模式下可选择重试或仍然保存', checks };
    }
    const { ready, pending } = readiness(builderCheck, runtimeCheck);

    const answers = {
      name: app.name, dockerfile: app.dockerfile, ports: app.ports,
      healthcheckPath: app.healthcheckPath, healthcheckHostPort: app.healthcheckHostPort, envFile: app.envFile,
      builderUrl: machines.builderUrl, builderToken: machines.builderToken, builderTokenRef: machines.builderTokenRef,
      targetName: machines.targetName, runtimeUrl: machines.runtimeUrl, runtimeToken: machines.runtimeToken, runtimeTokenRef: machines.runtimeTokenRef,
      registryUrl: registry.url, registryNamespace: registry.namespace,
    };
    const plan = planFileWrites(cwd, answers, { specPath: det.existingSpecPath, configPath: det.existingConfigPath });
    const invalidFiles = plan.files.filter((f) => f.existingInvalid).map((f) => f.rel);
    if (invalidFiles.length > 0 && !p.interactive) {
      return { ok: false, reason: 'invalid-existing-file', message: `现有文件无法解析，非交互模式不覆盖：${invalidFiles.join('、')}。请在 TTY 下运行 ship init 并确认替换（原内容会备份）` };
    }

    const warnings = [...plan.warnings];

    if (plan.files.every((f) => !f.changed)) {
      log.info('配置与现状一致，无需写入');
      appendIgnoreRecheck(cwd, plan, false, warnings);
      await trySave({ ...progress, step: 'done', blocked: ready ? undefined : 'check-failed' });
      return { ok: true, ready, wrote: [], backups: [], checks, next: renderNextSteps(answers.targetName, ready, pending), warnings: [...warnings, ...stateWarnings], pending };
    }

    p.out.write(`${renderReview(answers, plan, builderCheck, runtimeCheck, registryCheck)}\n`);
    if (p.interactive) {
      const go = await p.ask({ field: 'confirmWrite', label: '写入以上变更？', default: 'n' });
      if (go !== 'y') throw new Cancelled();
    }

    const outcome = await applyFileWrites(cwd, plan);
    appendIgnoreRecheck(cwd, plan, outcome.wrote.some((rel) => rel === plan.files.find((f) => f.secret)?.rel), warnings);
    await trySave({ ...progress, step: 'done', blocked: ready ? undefined : 'check-failed' });
    return { ok: true, ready, wrote: outcome.wrote, backups: outcome.backups, checks, next: renderNextSteps(answers.targetName, ready, pending), warnings: [...warnings, ...stateWarnings], pending };
  } catch (e) {
    if (e instanceof Cancelled) {
      await trySave(progress);
      const saveNote = stateWarnings.length > 0 ? `（注意：${stateWarnings.join('；')}）` : '';
      return { ok: false, reason: 'cancelled', message: `已取消：进度已保存到 .ship/init-state.json，重新运行 ship init 可从已答项继续。${saveNote}` };
    }
    if (e instanceof SpecError || e instanceof ConfigError) return { ok: false, reason: 'invalid-answers', message: `生成的配置未通过现有校验：${e.message}` };
    if (e instanceof FileConflictError) return { ok: false, reason: 'file-conflict', message: e.message };
    if (e instanceof WriteFailedError) return { ok: false, reason: 'write-failed', message: e.message };
    return { ok: false, reason: 'write-failed', message: `写入失败：${e instanceof Error ? e.message : String(e)}` };
  }
}
