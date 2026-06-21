/**
 * Built-in skills for @svton/agent-app.
 *
 * These are compiled into the package so users get them without
 * needing to host SKILL.md files. Each skill is a SkillDefinition
 * built from the project's skills/ directory.
 */

import type { SkillDefinition } from '@svton/agent-core';

const VERIFY_BEFORE_DONE_INSTRUCTIONS = `# Verify Before Done

Apply this as a completion gate after code edits and before the final response. The skill forces requirement-fit review, automated verification choice, real-data validation for data-dependent changes, and honest reporting of gaps or blockers.

## When to Use
- After completing any code modification, bug fix, feature, refactor, or test addition.
- Before responding to the user that work is done.

## Rules
1. Compare the actual output against the user's original request — list any gaps.
2. Run automated verification appropriate to the change (type-check, unit tests, e2e).
3. For data-dependent changes, verify against real data, not mocks.
4. Report honestly: what passed, what failed, what couldn't be verified.`;

const PLAN_BEFORE_CODE_INSTRUCTIONS = `# Plan Before Code

Apply this before implementation begins. Turn the user's request into a clarified scope, a persistent TODO list, and an execution loop.

## When to Use
- At the start of non-trivial code or product work.
- When requirements are ambiguous or complex.

## Rules
1. Clarify ambiguous requirements before coding — ask the user.
2. Create a persistent TODO document (markdown or task list).
3. Summarize the plan to the user before executing.
4. Execute from the plan, updating each item status as completed.`;

const ENGINEERING_CRAFT_INSTRUCTIONS = `# Engineering Craft Principles

Apply this when a frontend surface has collapsed presentation, state, and fallback behavior into one place.

## When to Use
- React/TypeScript TSX refactors: split overloaded components.
- Clarify variant or mode boundaries.
- Remove duplicated useState/useEffect derived state.

## Rules
1. Favor narrower components with explicit props.
2. Move derived state to useMemo, not useState.
3. Extract async behavior into custom hooks.
4. Single responsibility per component.`;

const UNIVERSAL_CRAFT_INSTRUCTIONS = `# Universal Craft Principles

Apply this when general-purpose code has collapsed orchestration, execution, state mutation, and fallback policy into the same place.

## When to Use
- Framework-agnostic refactors.
- Untangling modules, services, handlers, jobs, and controllers.

## Rules
1. Favor explicit contracts and single-purpose modules.
2. Isolate orchestration from execution.
3. Centralize fallback/retry behavior in services.
4. Remove redundant persisted state.`;

const CODEGRAPH_NAVIGATION_INSTRUCTIONS = `# CodeGraph CLI Navigation

Apply this when a user request is complex enough that you should build a code graph before changing code.

## When to Use
- Complex code work requiring impact analysis.
- Caller/callee tracing.
- Affected tests identification.

## Rules
1. Prefer CodeGraph CLI for navigation and impact analysis.
2. If CLI unavailable, manually inspect all relevant code.
3. Final judgment must come from real source files, tests, and logs.`;

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    name: 'verify-before-done',
    description: 'Use before finalizing any code change: compare work against request, run verification, report gaps.',
    instructions: VERIFY_BEFORE_DONE_INSTRUCTIONS,
    whenToUse: [
      '完成代码修改后准备回复之前',
      '需要验证改动是否符合需求',
    ],
    triggerSignals: [
      '完成', '修改', '修复', '实现', '收尾', 'verify', 'done', 'test', 'validation',
    ],
    avoidWhen: [
      '没有修改项目文件',
      '用户明确要求不要运行验证',
    ],
    scope: 'system' as const,
    source: { type: 'builtin' },
  },
  {
    name: 'plan-before-code',
    description: 'Use at the start of non-trivial work: clarify requirements, create TODO, execute from plan.',
    instructions: PLAN_BEFORE_CODE_INSTRUCTIONS,
    whenToUse: [
      '非简单任务开始前',
      '需求不明确或复杂时',
    ],
    triggerSignals: [
      '开始', '实现', '计划', '规划', 'plan', 'todo', 'requirement', 'scope',
    ],
    scope: 'system' as const,
    source: { type: 'builtin' },
  },
  {
    name: 'engineering-craft-principles',
    description: 'Use for React/TypeScript refactors: split components, clarify variants, remove derived state.',
    instructions: ENGINEERING_CRAFT_INSTRUCTIONS,
    whenToUse: [
      'React/TypeScript 组件重构',
      '拆分过大的组件',
    ],
    triggerSignals: [
      '重构', '拆分', '组件', 'refactor', 'component', 'split', 'derived',
    ],
    scope: 'system' as const,
    source: { type: 'builtin' },
  },
  {
    name: 'universal-craft-principles',
    description: 'Use for framework-agnostic refactors: untangle modules, isolate orchestration, centralize fallbacks.',
    instructions: UNIVERSAL_CRAFT_INSTRUCTIONS,
    whenToUse: [
      '通用代码重构',
      '解耦模块、服务、控制器',
    ],
    triggerSignals: [
      '重构', '解耦', '模块', 'refactor', 'module', 'service', 'orchestration',
    ],
    scope: 'system' as const,
    source: { type: 'builtin' },
  },
  {
    name: 'codegraph-cli-navigation',
    description: 'Use CodeGraph CLI for complex code work, impact analysis, caller/callee tracing.',
    instructions: CODEGRAPH_NAVIGATION_INSTRUCTIONS,
    whenToUse: [
      '复杂的代码修改需要影响分析',
      '需要追踪调用链',
    ],
    triggerSignals: [
      '代码图', '影响分析', '调用链', 'codegraph', 'impact', 'caller', 'callee',
    ],
    scope: 'system' as const,
    source: { type: 'builtin' },
  },
];
