/**
 * Built-in Code Review skill.
 *
 * Activates when the user asks to review code changes — whether against
 * a branch, a specific commit, or uncommitted working-tree edits.
 */

import type { SkillDefinition } from '../types';

export const codeReviewSkill: SkillDefinition = {
  name: 'code-review',
  description: 'Code review against branches, commits, or uncommitted changes',
  scope: 'system',
  version: '1.0.0',
  source: { type: 'builtin' },

  // ── Structured trigger signals ──
  triggerSignals: ['/review', 'code review', '审查', 'review code'],
  whenToUse: [
    'reviewing code changes',
    'analyzing diffs',
    'finding bugs in code',
    'checking pull requests',
    'evaluating code quality',
  ],
  avoidWhen: [
    'writing new code',
    'creating files',
    'running tests',
    'deploying applications',
  ],

  // ── Trigger config ──
  trigger: {
    type: 'implicit',
    patterns: ['/review', 'review code', 'code review', '审查代码', '代码审查'],
  },

  // ── Tool dependencies ──
  requiredTools: ['git_diff'],
  allowedTools: ['git_diff', 'git_log_range', 'file_read', 'grep', 'glob'],

  // ── Instructions (loaded on demand) ──
  instructions: `# Code Review Skill

You are performing a structured code review. Follow these steps precisely.

## 1. Gather the Diff

Use the **git_diff** tool to retrieve the changes under review:

- If the user specifies a base branch (e.g. "review against main"), call
  \`git_diff\` with \`base: "main"\`.
- If the user references a commit range, pass both \`base\` and \`head\`.
- If no target is given, default to reviewing **uncommitted changes**
  (\`git_diff\` with no arguments reviews the working tree).
- If the diff is very large, first call \`git_diff\` with \`stat_only: true\`
  to get an overview, then fetch full diffs for individual files of interest.

Optionally use **git_log_range** to see the commit messages in the range
for additional context.

## 2. Analyze Each File

For every changed file, examine:

- **Correctness**: Logic errors, off-by-one, null/undefined access, race conditions.
- **Security**: Injection, hardcoded secrets, unsafe deserialization, path traversal.
- **Performance**: O(n²) loops, unnecessary allocations, missing indexes, N+1 queries.
- **Maintainability**: Naming, dead code, duplication, overly complex functions.
- **Style**: Consistency with surrounding code, missing or incorrect types.

## 3. Report Findings

Present findings in a structured, prioritized format:

### Severity Levels
- **error** — Bugs, security vulnerabilities, data-loss risks. Must fix.
- **warning** — Code smells, likely bugs, performance issues. Should fix.
- **info** — Style suggestions, minor improvements. Optional.

### Format for Each Finding
\`\`\`
[SEVERITY] path/to/file.ts:42
Issue: Brief description of the problem.
Suggestion: How to fix it.
\`\`\`

Group findings by file. Lead with the highest-severity issues.

## 4. Summary

Conclude with a short summary:

- Total findings by severity.
- Overall assessment: Approve / Request changes / Block.
- One or two sentences explaining the verdict.

## Guidelines

- Be specific — always reference \`file:line\`.
- Be constructive — suggest fixes, don't just point out problems.
- Acknowledge good practices when relevant.
- Don't comment on trivial formatting unless it breaks consistency.
- If the diff is empty, say so and suggest how to specify the range.
- Stay focused on the diff — don't review unchanged code unless the changed
  code reveals a pre-existing problem.
`,
};
