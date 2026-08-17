import { expect, test } from '@playwright/test';
import { appReady, seedE2e } from './helpers';
import {
  installDiagnostics,
  type EvidenceRecord,
} from './shared-web-locale.evidence';
import {
  finalizeEvidence,
  markEvidenceGroupComplete,
  prepareEvidenceRun,
} from './shared-web-locale.manifest';
import { runDecisionScenarios } from './shared-web-locale.decision.scenarios';
import {
  runResultScenarios,
  type ResultLabels,
} from './shared-web-locale.result.scenarios';
import {
  runSettingsScenarios,
  runShellScenarios,
  type LocaleLabels,
} from './shared-web-locale.shell.scenarios';
import { runTimelineScenarios } from './shared-web-locale.timeline.scenarios';
import { timelineLabels } from './shared-web-locale.timeline.support';
import { installSkillAssetObservation } from './shared-web-locale.skills.scenario';

const locales = [
  {
    code: 'en', browser: 'en-US', html: 'en', nav: 'Open conversation navigation',
    placeholder: 'Describe what you want to do... Type / for commands or @ to reference',
    inputLabel: 'Message input', sendLabel: 'Send',
    searchbox: 'Search conversation titles', manage: /^Manage /, menuFirst: 'Rename',
    auxiliary: [
      { kind: 'state', id: 'automation', button: 'Automation', heading: 'Automation', state: 'Automation requires the desktop app' },
      { kind: 'skills', id: 'skills', button: 'Skills', heading: 'Skills', manage: 'Manage in settings',
        empty: 'No skills are registered', userScope: 'User', systemScope: 'System' },
      { kind: 'state', id: 'agents', button: 'Agents', heading: 'Custom Agents', state: 'The Agent manager is unavailable' },
      { kind: 'state', id: 'integrations', button: 'Integrations', heading: 'Integrations', state: 'The integration manager is unavailable' },
    ],
    settings: 'Settings', back: 'Back', settingsCategory: 'Settings category', marketplace: 'Skill marketplace',
    marketplaceLoading: 'Loading...', marketplaceError: 'Marketplace could not be loaded.',
    approvalTitle: 'Approve this tool?', cancel: 'Cancel', decline: 'Decline',
    allowSession: 'Allow for session', allowOnce: 'Allow once', cancelled: 'Cancelled',
    inputTitle: 'Input required', waiting: 'Waiting for your answers.',
    required: 'Answer every required question.', other: 'Other', submit: 'Submit answers',
    addAttachment: 'Add attachment', referenceFile: 'Reference file',
    controllerTooLarge: '“动态-controller.txt” exceeds 64 KiB and was not added.',
    imageTooLarge: '“动态-image.png” exceeds 10 MiB and was not added.',
    transcript: 'Conversation transcript', youMessage: 'Message from You', assistantMessage: 'Message from Assistant',
    oneFile: '1 file changed', twoFiles: '2 files changed', fileTree: 'File Tree',
    expand: 'Expand', documentKind: 'REPORT', open: 'Open',
    artifactPanel: 'Artifact panel', artifactOpened: 'Artifact panel opened.',
    preview: 'Preview', edit: 'Edit', closePanel: 'Return to conversation and close artifact panel',
    dirtyTitle: 'Discard unsaved changes?', continueEditing: 'Continue editing',
    discardChanges: 'Discard changes',
    unsavedClose: 'There are unsaved changes. Confirm before discarding them.',
    readonlyLabel: 'Read-only target', openInHost: 'Open in host',
    localPathUnsupported: 'The Web host cannot open local paths directly.',
  },
  {
    code: 'zh', browser: 'zh-CN', html: 'zh-CN', nav: '打开对话导航',
    placeholder: '描述你想做的事情... 输入 / 查看命令，输入 @ 引用',
    inputLabel: '消息输入', sendLabel: '发送',
    searchbox: '搜索对话标题', manage: /^管理/, menuFirst: '重命名',
    auxiliary: [
      { kind: 'state', id: 'automation', button: '自动化', heading: '自动化任务', state: '自动化任务需要桌面端运行' },
      { kind: 'skills', id: 'skills', button: '技能', heading: '技能', manage: '在设置中管理',
        empty: '暂无注册的技能', userScope: '用户', systemScope: '系统' },
      { kind: 'state', id: 'agents', button: 'Agents', heading: '自定义 Agents', state: 'Agent 管理器未初始化' },
      { kind: 'state', id: 'integrations', button: '集成', heading: '集成', state: '集成管理器未初始化' },
    ],
    settings: '设置', back: '返回', settingsCategory: '设置类别', marketplace: '技能市场',
    marketplaceLoading: '加载中...', marketplaceError: '技能市场加载失败。',
    approvalTitle: '批准此工具？', cancel: '取消', decline: '拒绝',
    allowSession: '本会话允许', allowOnce: '仅允许一次', cancelled: '已取消',
    inputTitle: '需要输入', waiting: '正在等待你的回答。',
    required: '请回答所有必答问题。', other: '其他', submit: '提交回答',
    addAttachment: '添加附件', referenceFile: '引用文件',
    controllerTooLarge: '“动态-controller.txt”超过 64 KiB，未添加。',
    imageTooLarge: '“动态-image.png”超过 10 MiB，未添加。',
    transcript: '对话记录', youMessage: '来自你的消息', assistantMessage: '来自助手的消息',
    oneFile: '1 个文件变更', twoFiles: '2 个文件变更', fileTree: '目录结构',
    expand: '展开', documentKind: '报告', open: '打开',
    artifactPanel: '内容面板', artifactOpened: '已打开内容面板。',
    preview: '预览', edit: '编辑', closePanel: '返回对话并关闭内容面板',
    dirtyTitle: '放弃未保存更改？', continueEditing: '继续编辑', discardChanges: '放弃更改',
    unsavedClose: '存在未保存更改，请确认是否放弃。',
    readonlyLabel: '只读目标', openInHost: '在主机中打开',
    localPathUnsupported: 'Web 主机不能直接打开本地路径。',
  },
] as const;
const records: EvidenceRecord[] = [];

test.describe.configure({ mode: 'serial' });
test.beforeAll(prepareEvidenceRun);

for (const locale of locales) {
  test(`${locale.code} shell, session race, auxiliary, and Settings evidence`, async ({ browser }) => {
    const context = await browser.newContext({
      locale: locale.browser,
      extraHTTPHeaders: { 'accept-language': locale.browser },
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      colorScheme: 'dark', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const diagnostics = installDiagnostics(page);
    const skillAssets = installSkillAssetObservation(page);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    records.push(...await runShellScenarios(page, locale as LocaleLabels, diagnostics, skillAssets));
    records.push(...await runSettingsScenarios(page, locale as LocaleLabels, diagnostics));
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    markEvidenceGroupComplete(locale.code, 'shell');
    await context.close();
  });

  test(`${locale.code} approval and request-input evidence`, async ({ browser }) => {
    const context = await browser.newContext({
      locale: locale.browser,
      extraHTTPHeaders: { 'accept-language': locale.browser },
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      colorScheme: 'dark', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const diagnostics = installDiagnostics(page);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    records.push(...await runDecisionScenarios(page, locale, diagnostics));
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    markEvidenceGroupComplete(locale.code, 'decisions');
    await context.close();
  });

  test(`${locale.code} shared result and presenter evidence`, async ({ browser }) => {
    const context = await browser.newContext({
      locale: locale.browser,
      extraHTTPHeaders: { 'accept-language': locale.browser },
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      colorScheme: 'dark', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const diagnostics = installDiagnostics(page);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    records.push(...await runResultScenarios(page, locale as ResultLabels, diagnostics));
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    markEvidenceGroupComplete(locale.code, 'results');
    await context.close();
  });

  test(`${locale.code} typed timeline evidence`, async ({ browser }) => {
    const context = await browser.newContext({
      locale: locale.browser,
      extraHTTPHeaders: { 'accept-language': locale.browser },
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      colorScheme: 'dark', reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const diagnostics = installDiagnostics(page);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    const labels = timelineLabels.find((candidate) => candidate.code === locale.code);
    if (!labels) throw new Error(`Missing timeline labels for ${locale.code}`);
    records.push(...await runTimelineScenarios(page, labels, diagnostics));
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    markEvidenceGroupComplete(locale.code, 'timeline');
    await context.close();
  });
}

test.afterAll(() => finalizeEvidence(records));
