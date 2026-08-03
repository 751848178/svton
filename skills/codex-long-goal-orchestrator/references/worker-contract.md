# Worker Contract

Start the worker prompt with the bounded worker objective, not the full long goal.

Include:

- one slice and explicit stop condition
- allowed and forbidden paths
- acceptance criteria and verification signal
- result or board location
- instruction not to read old sessions unless explicitly listed
- instruction not to create successor workers

If the worker hits a split condition:

1. Save compact completed facts, changed paths, checks, risks, and next action.
2. Report `handoff_required`.
3. Stop without marking the long objective blocked.

The orchestrator reviews the result, updates the board, and decides the next task. A worker result is evidence, not permission to expand scope or create tasks.
