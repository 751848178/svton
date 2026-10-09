# Shipkit 本机发布工作台

Platform: web. Users operate a local control plane while AI Agents retain the CLI.

The approved product is `shipkit/prototype/PRODUCT.md`. The formal frontend preserves project list → project detail → choose services → review plan → explicitly execute → manually view result. It displays only API-backed configuration, Git, Agent, task and history facts.

Project registration and metadata editing store local directory/config references and service entry URLs. Task identity stays in the URL so refresh reconnects to the durable backend ledger. A completed execution does not navigate automatically. Release history, historical service rollback, cancellation acknowledgement, recovery failure, skipped health probes and independent cleanup results are explicit.

No login or permissions screen. No browser access to credentials, arbitrary commands, fault scenarios or production test controls.
