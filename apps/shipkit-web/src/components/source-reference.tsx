import type { ServiceSource } from '@/lib/source-contracts';

export function SourceReference({ value }: { value?: ServiceSource | null }) {
  if (!value) return <p className="subtle">此记录未保存源码来源。</p>;
  return <div className="source-reference"><p className="subtle">{value.type === 'git' ? 'Git 源码' : '目录快照'}{value.ref && ` · ${value.ref}`}</p>{value.sha && <p className="mono source-commit">提交 {value.sha}</p>}{value.repo && <p className="subtle source-url">{value.repo}</p>}{value.contentDigest && <p className="mono source-commit">快照 {value.contentDigest}</p>}{!value.sha && !value.contentDigest && <p className="subtle">原记录未保存提交或快照指纹。</p>}</div>;
}
