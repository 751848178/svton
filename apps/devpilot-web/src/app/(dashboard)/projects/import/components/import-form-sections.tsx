/**
 * 项目接入表单分区组件（barrel）
 *
 * 各分区实现已按单一职责拆分到 sections/ 目录，此处仅做统一出口，
 * 供页面按原路径导入，避免改动页面导入语句。
 */

export { ScopeSection } from './sections/scope-section';
export { BasicInfoSection } from './sections/basic-info-section';
export { RepoStackSection } from './sections/repo-stack-section';
export { DeploySection } from './sections/deploy-section';
export { EnvironmentSection } from './sections/environment-section';
export { IMPORT_SECTION_ANCHORS } from './sections/import-section-primitives';
