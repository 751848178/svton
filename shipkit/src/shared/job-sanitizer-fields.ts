// Schema primitives: only declared protocol paths can preserve metadata values.
import { isRecord } from './obj.js';
export interface RedactionPool { redactValue(value: unknown): unknown }

export type Field = (value: unknown, secrets: RedactionPool) => unknown;
export type Fields = Record<string, Field>;
export const text: Field = (value, secrets) => secrets.redactValue(value);
export const metadata: Field = (value, secrets) => value === null || value === undefined ||
  ['string', 'number', 'boolean'].includes(typeof value) ? value : secrets.redactValue(value);
export const oneOf = (...values: unknown[]): Field => (value, secrets) => values.includes(value) ? value : secrets.redactValue(value);
export const list = (field: Field): Field => (value, secrets) => Array.isArray(value)
  ? value.map(item => field(item, secrets)) : secrets.redactValue(value);
export const record = (fields: Fields): Field => (value, secrets) => isRecord(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, (Object.hasOwn(fields, key) ? fields[key]! : text)(item, secrets)])) : secrets.redactValue(value);
export const mapping = (field: Field): Field => (value, secrets) => isRecord(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, field(item, secrets)])) : secrets.redactValue(value);

const sourceFields: Fields = { type: oneOf('git', 'tarball'), sha: metadata, repo: metadata, ref: metadata, contentDigest: metadata };
export const source: Field = (value, secrets) => isRecord(value) && ['git', 'tarball'].includes(String(value.type))
  ? record(sourceFields)(value, secrets) : secrets.redactValue(value);
export const configRef = record({ versionId: metadata, version: metadata, name: metadata, serviceKey: metadata });
export const serviceEntry = record({ imageRef: metadata, hasEnv: metadata, source, configRef });
