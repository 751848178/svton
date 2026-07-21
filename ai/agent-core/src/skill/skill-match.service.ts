import type { SkillDefinition } from './types';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'not', 'but', 'all', 'any', 'our', 'its', 'was', 'has', 'had',
  'with', 'from', 'this', 'that', 'were', 'have', 'will', 'can', 'out', 'off', 'over',
  'into', 'they', 'them', 'their', 'there', 'here', 'than', 'then', 'been', 'also',
  'just', 'only', 'some', 'such', 'each', 'more', 'most', 'other', 'same', 'about',
  'after', 'before', 'under', 'these', 'those', 'who', 'how', 'why', 'when', 'what',
  'where', 'which', 'while', 'use', 'using', 'used', 'your', 'make', 'like', 'want',
  'need', 'get', 'run', 'try', 'see', 'say', 'way', 'one', 'two', 'new', 'now', 'yes',
  'via', 'per', 'did', 'does', 'are', 'you', 'she', 'him', 'his', 'her',
]);

const CJK_RE = /[一-鿿぀-ヿ가-힯]/;

function tokenize(signal: string): string[] {
  return signal
    .toLowerCase()
    .split(/[\s、，。；;,]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => {
      if (!w) return false;
      return CJK_RE.test(w)
        ? w.length >= 2
        : w.length >= 3 && !STOPWORDS.has(w);
    });
}

function tokenMatches(token: string, lower: string): boolean {
  if (CJK_RE.test(token)) return lower.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(lower);
}

function phraseHasAnyMatch(phrase: string, lower: string): boolean {
  return tokenize(phrase).some((word) => tokenMatches(word, lower));
}

function phraseHasEveryMatch(phrase: string, lower: string): boolean {
  const words = tokenize(phrase);
  return words.length > 0 && words.every((word) => tokenMatches(word, lower));
}

function hasPositiveMatch(skill: SkillDefinition, lower: string): boolean {
  if (lower.includes(`/${skill.name}`)) return true;
  if (skill.triggerSignals?.some((sig) => phraseHasAnyMatch(sig, lower))) return true;
  if (skill.trigger?.type === 'implicit' && skill.trigger.patterns) {
    return skill.trigger.patterns.some((p) => lower.includes(p.toLowerCase()));
  }
  return skill.whenToUse?.some((phrase) => phraseHasAnyMatch(phrase, lower)) ?? false;
}

export function matchesSkillRequest(skill: SkillDefinition, message: string): boolean {
  const lower = message.toLowerCase();
  if (!hasPositiveMatch(skill, lower)) return false;
  return !skill.avoidWhen?.some((phrase) => phraseHasEveryMatch(phrase, lower));
}
