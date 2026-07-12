# task-pull-cli Decisions

- CLI owns local runtime ergonomics: config, polling, command execution, cancellation, summaries, and process exit signals.
- CLI consumes API lifecycle responses but does not define server mutation semantics.
- Runner files should remain orchestration entries; pure result/config/execution details belong in focused helpers or services.
