import type { EvidenceField } from '@/lib/log-evidence-fields';
import { ImageReference } from './image-reference';

export function LogEvidenceFields({ fields }: { fields: EvidenceField[] }) {
  return <dl className="log-result-fields">{fields.map((field, index) => <div key={`${field.key}:${index}`}>
    <dt>{field.label}</dt><dd>{field.children ? <LogEvidenceFields fields={field.children} /> : field.image ? <ImageReference value={field.value} /> : <span className={field.mono ? 'mono' : undefined}>{field.value}</span>}</dd>
  </div>)}</dl>;
}
