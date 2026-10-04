// App & registry question batches. Existing explicit config is the default;
// EXPOSE detection only fills gaps (M1-04), and set optional fields offer an
// explicit keep / change / clear flow instead of empty-input ambiguity (M1-11).

import { NAME_RE } from '../../shared/spec-schema.js';
import { registryNamespaceError, registryUrlError } from '../../shared/config.js';
import type { Detection } from './detect.js';
import { CANCEL, Cancelled, type Prompter, type Question } from './prompt.js';

export { Cancelled } from './prompt.js';

export interface AppAnswers {
  name: string;
  dockerfile: string;
  ports: string[];
  healthcheckPath: string | null;
  healthcheckHostPort: number | null;
  envFile: string | null;
}

export interface RegistryAnswers {
  url: string;
  namespace: string;
}

type Validate = (v: string) => string | null;

/** ask with up to 5 interactive retries; non-interactive aborts on an invalid default */
async function ask(p: Prompter, q: Question, validate?: Validate): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const a = await p.ask(q);
    if (a === CANCEL) throw new Cancelled();
    if (a === '') return a; // cleared (clearable) or recorded-missing (non-interactive)
    const err = validate?.(a) ?? null;
    if (!err) return a;
    if (!p.interactive) throw new Error(`“${q.label}”的现有值无效：${err}`);
    p.out.write(`  ✗ ${err}\n`);
  }
  throw new Cancelled();
}

function portListError(v: string): string | null {
  for (const item of v.split(/\s+/).filter(Boolean)) {
    if (!/^\d{1,5}(:\d{1,5})?$/.test(item)) return `端口映射 ${item} 应为 HOST:CONTAINER 或 CONTAINER`;
    for (const part of item.split(':')) {
      if (Number(part) < 1 || Number(part) > 65535) return `端口 ${part} 超出范围 1-65535`;
    }
  }
  return null;
}

function hostPortOf(ports: string[]): number | undefined {
  const first = ports[0];
  if (!first) return undefined;
  return Number(first.split(':')[0]);
}

function containerPortOf(mapping: string): number {
  return Number(mapping.includes(':') ? mapping.split(':')[1] : mapping);
}

/** A still-valid draft (file unchanged since it was saved) is NEWER intent than
 *  the file and wins (R4); an explicit empty list means "no mapping" and is never
 *  re-filled from EXPOSE; non-interactive never expands a set mapping (M1-04) */
export function portsDefault(existing: string[] | undefined, prior: string[] | undefined, exposed: number[], interactive: boolean): string | undefined {
  const base = prior !== undefined ? prior : existing;
  if (base === undefined) {
    return exposed.length > 0 ? exposed.map((n) => `${n}:${n}`).join(' ') : undefined;
  }
  if (!interactive || base.length === 0) return base.length > 0 ? base.join(' ') : '';
  const covered = new Set(base.map(containerPortOf));
  const filled = [...base, ...exposed.filter((n) => !covered.has(n)).map((n) => `${n}:${n}`)];
  return filled.join(' ');
}

export async function askApp(det: Detection, src: {
  name?: string; nameSource: string; dockerfile?: string; existingPorts?: string[]; priorPorts?: string[];
  healthcheckPath?: string; healthcheckHostPort?: number; envFile?: string;
}, p: Prompter): Promise<AppAnswers> {
  const name = await ask(p, {
    field: 'name', label: '应用名称', default: src.name,
    hint: `来源：${src.nameSource}（用于镜像名与运行机上的应用标识）`,
  }, (v) => (NAME_RE.test(v) ? null : `名称需匹配 ${NAME_RE}（小写字母开头，可含数字和连字符）`));

  // resumed choice must still be a valid candidate (M1-07): re-validate on resume
  const priorDockerfile = src.dockerfile !== undefined && det.dockerfiles.includes(src.dockerfile) ? src.dockerfile : undefined;
  const dockerfile = det.dockerfiles.length === 1
    ? await ask(p, { field: 'dockerfile', label: 'Dockerfile', default: det.dockerfiles[0], hint: '来源：目录内检测到唯一 Dockerfile' })
    : await ask(p, {
      field: 'dockerfile', label: '选择 Dockerfile（存在多个候选）', default: priorDockerfile,
      choices: det.dockerfiles.map((d) => ({ value: d, label: d })),
      hint: '来源：目录扫描；多候选必须显式选择，不做猜测',
    });

  const exposed = det.portsFor(dockerfile);
  const portsDefaultStr = portsDefault(src.existingPorts, src.priorPorts, exposed, p.interactive);
  const portsRaw = await ask(p, {
    field: 'ports', label: '应用端口映射', optional: true, clearable: true,
    default: portsDefaultStr,
    hint: portsDefaultStr !== undefined
      ? `来源：现有配置优先，EXPOSE ${exposed.join(', ') || '无'} 仅补空缺；格式 HOST:CONTAINER，多个空格分隔；回车保留，输入 - 清空全部映射`
      : '未从现有配置或 EXPOSE 检测到端口；格式 HOST:CONTAINER，多个用空格分隔，留空则不映射',
  }, portListError);
  const ports = portsRaw.split(/\s+/).filter(Boolean);

  const healthcheckPath = await ask(p, {
    field: 'healthcheckPath', label: '健康检查路径', optional: true, clearable: true,
    default: src.healthcheckPath,
    hint: `需要应用真实提供的路径（如 /health）；不猜测默认值${src.healthcheckPath ? '；回车保留现有值，输入 - 清除健康检查' : '；留空则不配置健康检查'}`,
  }, (v) => (v.startsWith('/') ? null : '路径需以 / 开头'));

  let healthcheckHostPort: number | null = null;
  if (healthcheckPath) {
    const def = src.healthcheckHostPort !== undefined ? String(src.healthcheckHostPort) : hostPortOf(ports) !== undefined ? String(hostPortOf(ports)) : undefined;
    const v = await ask(p, {
      field: 'healthcheckHostPort', label: '健康检查宿主机端口', clearable: true,
      default: def,
      hint: def !== undefined
        ? '来源：应用端口映射的宿主机端口；指向运行服务器的端口；回车保留，输入 - 清除'
        : '运行服务器上可访问该应用的宿主机端口',
    }, (v2) => (Number(v2) >= 1 && Number(v2) <= 65535 ? null : '端口需为 1-65535'));
    healthcheckHostPort = v ? Number(v) : null;
  }

  const envFile = await ask(p, {
    field: 'envFile', label: '运行时环境变量文件', optional: true, clearable: true,
    default: src.envFile,
    hint: `如 deploy.env；部署时上传该文件内容，文件需存在${src.envFile ? '；回车保留现有值，输入 - 清除（沿用运行机现有环境变量）' : '；留空则沿用运行机现有环境变量'}`,
  });
  return { name, dockerfile, ports, healthcheckPath: healthcheckPath || null, healthcheckHostPort, envFile: envFile || null };
}

export async function askRegistry(src: { url?: string; namespace?: string }, p: Prompter): Promise<RegistryAnswers> {
  const url = await ask(p, {
    field: 'registryUrl', label: '镜像仓库地址', default: src.url,
    hint: 'Registry 主机名（可含端口），不带 https://，如 registry.example.com 或 xxx.tencentcloudcr.com',
  }, (v) => registryUrlError(v));
  const namespace = await ask(p, {
    field: 'registryNamespace', label: '镜像命名空间', default: src.namespace,
    hint: '已建好的命名空间，镜像将推送到 <地址>/<命名空间>/<应用名>',
  }, (v) => registryNamespaceError(v));
  return { url, namespace };
}
