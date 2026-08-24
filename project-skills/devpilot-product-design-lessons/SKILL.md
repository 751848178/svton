---
name: devpilot-product-design-lessons
description: Apply evidence-backed product and UX lessons from the Devpilot project/release redesign when simplifying information-dense operational pages. Use for Devpilot project, release, environment, configuration, Site, repository-analysis, and deployment experiences. It prevents backend terminology, duplicated summaries, vague actions, oversized cards, and policy-only displays from replacing the user's actual task.
---

# Devpilot Product Design Lessons

Design from the user's operational decision, then map real domain evidence into
that decision. Do not mirror service/model boundaries directly into navigation.

Read [the problem-solution ledger](references/problem-solution-ledger.md) when
planning or reviewing a project/release/configuration module.

## Decision order

1. Confirm the real user task, domain state, write path, and blocker from source.
2. Separate overview, execution, configuration, and evidence responsibilities.
3. Choose the smallest surface that supports the decision.
4. Translate technical objects into business language, retaining exact evidence
   behind progressive disclosure.
5. Put policies and gates in the flow where they actually decide or block work.
6. Verify every link/action reaches a real supported destination and state.

## Durable lessons

- Large area does not create importance. Match visual weight to information and
  decision weight.
- Environment is a scope selector unless comparing environments is itself the
  user's task.
- Current state, configuration, and execution history are different concepts;
  placing them on one page does not merge their domain semantics.
- Backend identifiers are evidence, not primary product copy.
- A collection is a table/list by default. Use a card only for a standalone
  object that benefits from independent grouping.
- Actions name their object/outcome, live beside their cause, and follow one
  hierarchy. Generic `立即处理` is not an information architecture.
- An overflow menu is for genuine overflow, not the default hiding place for all
  row operations.
- A policy that does not affect the visible execution path is documentation, not
  product behavior.
- Automatic recognition suggestions require review before they mutate current
  project facts. Audit evidence stays available without dominating the page.
- Global control-plane modules and project-scoped workflows may share domain
  services while retaining different navigation and interaction surfaces.

## Review gate

Reject a design or implementation when any primary statement or control cannot
be connected to real source data, a real supported action, and a clear resulting
state.
