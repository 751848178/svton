export interface EvidenceField { key: string; label: string; value?: string; children?: EvidenceField[]; mono?: boolean; image?: boolean }
const labels: Record<string, string> = {
  result: '执行结果', mode: '构建方式', provider: '云厂商', leaseRef: '构建实例', name: '服务', tag: '镜像标签',
  localImage: '构建镜像', imageRef: '镜像引用', digest: '镜像摘要', arch: '镜像架构', platform: '目标平台',
  builderRelease: '资源释放结果', app: '应用', releaseId: '运行版本标识', previousReleaseId: '发布前版本标识',
  changedServices: '更新服务', inheritedServices: '沿用服务', changedRefs: '实际部署镜像', verification: '检查结果',
  probes: '服务探针', checks: '检查项目', target: '运行目标', error: '错误原因', message: '说明',
};
const values: Record<string, Record<string, string>> = {
  mode: { dynamic: '动态构建机', static: '绑定构建机', local: '本机构建' },
  provider: { tencent: '腾讯云' },
  verification: { passed: '检查通过', skipped: '已跳过检查', failed: '检查失败' },
  builderRelease: { released: '已释放', retained: '保留复用', failed: '释放失败', 'not-required': '无需释放' },
};
export function hasEvidence(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function field(key: string, value: unknown): EvidenceField {
  const label = labels[key] || key;
  if (Array.isArray(value)) {
    if (!value.length) return { key, label, value: '无' };
    if (value.every(item => item == null || typeof item !== 'object')) return { key, label, value: value.map(item => item == null ? '—' : String(item)).join('、') };
    return { key, label, children: value.map((item, index) => ({ ...field(String(index), item), label: `第 ${index + 1} 项` })) };
  }
  if (value && typeof value === 'object') return { key, label, children: Object.entries(value).map(([name, item]) => field(name, item)) };
  const text = value == null ? '—' : typeof value === 'boolean' ? value ? '是' : '否' : String(value);
  return { key, label, value: values[key]?.[text] || text, mono: /(?:Id|Ref|Image|digest|arch|platform|tag)$/.test(key) || text.includes('@sha256:'), image: key === 'imageRef' || key === 'localImage' || text.includes('@sha256:') };
}
export function evidenceFields(value: unknown): EvidenceField[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    // Unwrap the executor envelope; service/attempt/status belongs to the row header.
    return entries.flatMap(([key, item]) => key === 'result' && item && typeof item === 'object' && !Array.isArray(item) ? Object.entries(item).map(([name, child]) => field(name, child)) : [field(key, item)]);
  }
  return [field('result', value)];
}
