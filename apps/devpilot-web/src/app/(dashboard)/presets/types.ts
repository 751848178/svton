/**
 * 预设域类型
 *
 * 单一职责：仅声明接口。
 */

export interface Preset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresetInput {
  name: string;
  config: unknown;
}

export interface PresetImport {
  name: string;
  config: unknown;
}
