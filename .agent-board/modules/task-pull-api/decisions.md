# task-pull-api Decisions

- API owns server-side lifecycle safety: auth, default-off gates, job lock matching, terminal job mutation, and linked-run finish sync.
- API does not own local command execution or CLI process/exit behavior.
- Helper extraction is allowed only when it preserves endpoint response shape and job mutation predicates.
