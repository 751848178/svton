import type { SkillDefinition, SkillSummary } from './types';

const CONTEXT_BUDGET_RATIO = 0.02; // ~2% of context for skill summaries
const DEFAULT_MAX_SUMMARY_CHARS = 8000;

/**
 * Manages skill definitions with progressive disclosure.
 *
 * Progressive disclosure:
 * - System prompt only gets skill name + description (~2% context budget)
 * - Full instructions are loaded on demand when a skill is invoked
 *
 * Matching uses:
 * - Explicit: /skill-name in user message
 * - Implicit: trigger.patterns, triggerSignals, whenToUse keywords
 * - Negative: avoidWhen signals suppress matching
 */
export class SkillManager {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  get(name: string): SkillDefinition | null {
    return this.skills.get(name) ?? null;
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get lightweight summaries for system prompt injection.
   * Respects the context budget (~2% of context window).
   */
  getSummaries(maxChars: number = DEFAULT_MAX_SUMMARY_CHARS): string {
    const lines: string[] = [];
    let charCount = 0;

    for (const skill of this.skills.values()) {
      const line = `- ${skill.name}: ${skill.description}`;
      if (charCount + line.length > maxChars) break;
      lines.push(line);
      charCount += line.length;
    }

    if (lines.length === 0) return '';
    return `Available skills (invoke with /skill-name or by describing the task):\n${lines.join('\n')}`;
  }

  /**
   * Load full instructions for a skill (on demand).
   */
  loadInstructions(name: string): string | null {
    const skill = this.skills.get(name);
    return skill?.instructions ?? null;
  }

  /** Common English filler words excluded from Latin keyword matching. */
  private static readonly STOPWORDS = new Set([
    'the', 'and', 'for', 'not', 'but', 'all', 'any', 'our', 'its', 'was', 'has', 'had',
    'with', 'from', 'this', 'that', 'were', 'have', 'will', 'can', 'out', 'off', 'over',
    'into', 'they', 'them', 'their', 'there', 'here', 'than', 'then', 'been', 'also',
    'just', 'only', 'some', 'such', 'each', 'more', 'most', 'other', 'same', 'about',
    'after', 'before', 'under', 'these', 'those', 'who', 'how', 'why', 'when', 'what',
    'where', 'which', 'while', 'use', 'using', 'used', 'your', 'make', 'like', 'want',
    'need', 'get', 'run', 'try', 'see', 'say', 'way', 'one', 'two', 'new', 'now', 'yes',
    'via', 'per', 'did', 'does', 'are', 'you', 'she', 'him', 'his', 'her',
  ]);

  private static readonly CJK_RE = /[一-鿿぀-ヿ가-힯]/;

  /**
   * Split a trigger phrase into meaningful keyword tokens.
   *
   * Script-aware so the matcher works for CJK requests, not just English:
   * - CJK tokens of length >= 2 are kept (验证 / 测试 / 调用 / 需求 are real words).
   * - Latin/digit tokens must be length >= 3 and not a common stopword, so
   *   "bug" / "e2e" / "fix" survive but "the" / "and" / "for" don't.
   * - Splits on whitespace and common CJK/Latin separators (、，。；;,) and strips
   *   edge punctuation, so "CodeGraph。" matches "codegraph".
   */
  private static tokenize(signal: string): string[] {
    return signal
      .toLowerCase()
      .split(/[\s、，。；;,]+/)
      .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
      .filter((w) => {
        if (!w) return false;
        return SkillManager.CJK_RE.test(w)
          ? w.length >= 2
          : w.length >= 3 && !SkillManager.STOPWORDS.has(w);
      });
  }

  /**
   * Match a token against the message. CJK tokens use substring matching (CJK has
   * no word boundaries); Latin tokens use whole-word matching so "bug" matches
   * "the login bug" but not "debug", and "test" matches "run tests" but not "latest".
   */
  private static tokenMatches(token: string, lower: string): boolean {
    if (SkillManager.CJK_RE.test(token)) return lower.includes(token);
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  }

  /**
   * Find skills relevant to a user message using multi-signal matching.
   *
   * Matching signals (in priority order):
   * 1. Explicit /skill-name invocation
   * 2. triggerSignals keywords (high weight)
   * 3. trigger.patterns keywords
   * 4. whenToUse keywords (medium weight)
   *
   * Negative signals:
   * - avoidWhen: if ALL words in an avoidWhen entry appear in the message, skip this skill
   */
  findRelevant(message: string): SkillDefinition[] {
    const lower = message.toLowerCase();
    const relevant: SkillDefinition[] = [];

    for (const skill of this.skills.values()) {
      // Check explicit invocation: /skill-name
      if (lower.includes(`/${skill.name}`)) {
        relevant.push(skill);
        continue;
      }

      // Check triggerSignals (high-weight signal)
      if (skill.triggerSignals?.length) {
        const matched = skill.triggerSignals.some((sig) =>
          SkillManager.tokenize(sig).some((word) => SkillManager.tokenMatches(word, lower)),
        );
        if (matched) {
          relevant.push(skill);
          continue;
        }
      }

      // Check trigger.patterns (legacy)
      if (skill.trigger?.type === 'implicit' && skill.trigger.patterns) {
        const matched = skill.trigger.patterns.some((p) => lower.includes(p.toLowerCase()));
        if (matched) {
          relevant.push(skill);
          continue;
        }
      }

      // Check whenToUse (medium-weight signal)
      if (skill.whenToUse?.length) {
        const matched = skill.whenToUse.some((phrase) => {
          const words = SkillManager.tokenize(phrase);
          return words.length > 0 && words.some((w) => SkillManager.tokenMatches(w, lower));
        });
        if (matched) {
          relevant.push(skill);
          continue;
        }
      }
    }

    // Apply avoidWhen negative filter
    return relevant.filter((skill) => {
      if (!skill.avoidWhen?.length) return true;
      // If ANY avoidWhen phrase fully matches, exclude
      return !skill.avoidWhen.some((phrase) => {
        const words = SkillManager.tokenize(phrase);
        return words.length > 0 && words.every((w) => SkillManager.tokenMatches(w, lower));
      });
    });
  }

  /**
   * Check if a skill's required tools are all available.
   */
  isSkillAvailable(skill: SkillDefinition, availableTools: string[]): boolean {
    if (!skill.requiredTools) return true;
    return skill.requiredTools.every((t) => availableTools.includes(t));
  }

  /**
   * Get the effective tool list when a skill is active.
   * Returns null if no tool restrictions apply.
   */
  getEffectiveTools(skill: SkillDefinition, allTools: string[]): string[] | null {
    if (!skill.allowedTools?.length && !skill.disallowedTools?.length) return null;

    let tools = allTools;
    if (skill.allowedTools?.length) {
      tools = tools.filter((t) => skill.allowedTools!.includes(t));
    }
    if (skill.disallowedTools?.length) {
      tools = tools.filter((t) => !skill.disallowedTools!.includes(t));
    }
    return tools;
  }

  clear(): void {
    this.skills.clear();
  }

  get size(): number {
    return this.skills.size;
  }
}
