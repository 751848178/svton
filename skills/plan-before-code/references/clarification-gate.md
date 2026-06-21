# Clarification Gate

Use this reference when the initial request is ambiguous and you need to decide whether to ask the user or proceed with assumptions.

## Ask Only For Decisions

Ask the user when the missing information would change one of these:

- User-visible behavior, data shape, permission model, billing or security behavior.
- Architecture, persistence, migration, integration provider, or public API contract.
- Scope boundary, acceptance criteria, rollout path, or verification strategy.
- Any irreversible operation or action that could destroy user data.

Do not ask when the answer can be discovered by reading the repository, running a safe command, inspecting existing conventions, or making a low-risk reversible assumption.

## Question Budget

- Ask 1 question when one decision blocks the whole direction.
- Ask up to 3 grouped questions when several decisions are tightly related.
- Continue with explicit assumptions when the ambiguity is low risk or can be corrected cheaply.
- If the user has already signaled urgency or asked for direct execution, bias toward safe assumptions and document them.

## Useful Question Shape

Prefer decision-oriented prompts:

```text
我准备按 X 做，因为它符合当前项目约定。这里唯一会影响实现方向的问题是：A 需要覆盖 B 场景吗？
```

Avoid broad prompts:

```text
你还有什么要求？
```

## Assumption Shape

When proceeding without a question, write the assumption into the TODO document:

```markdown
## Assumptions

- Treat the existing desktop behavior as the source of truth unless the web app already differs intentionally.
- Keep the new path backward-compatible with current configuration files.
```
