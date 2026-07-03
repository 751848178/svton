# Devpilot Progress Index

> Progress files are the stable per-phase anchors referenced by
> `docs-internal/devpilot/roadmap/05-phases.md`. This index was restored after
> the directory was missing in the current checkout.

## Phase Anchors

| Phase                                        | Progress File               | Current Source                                                                                                                |
| -------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0. Project onboarding entry                 | `P0-onboarding.md`          | Not restored in this slice; use `requirements-and-progress.md` and `project-onboarding-control-plane-roadmap.md` until split. |
| P1. Project environment and resource binding | `P1-environment-binding.md` | Not restored in this slice; roadmap lines remain in `project-onboarding-control-plane-roadmap.md`.                            |
| P2. Webhook and deployment runs              | `P2-webhook-deployment.md`  | Not restored in this slice.                                                                                                   |
| P3. Site governance                          | `P3-site-governance.md`     | Restored and updated through the current Sites structure slices.                                                              |
| P4. Application and service workspace        | `P4-app-service.md`         | Not restored in this slice.                                                                                                   |
| P5. Database and backup                      | `P5-database-backup.md`     | Not restored in this slice.                                                                                                   |
| P6. Monitoring                               | `P6-monitoring.md`          | Restored and updated through current Monitoring DTO, scheduler, controller, resource dashboard, service SLO dashboard, notification delivery read, payload builder, dispatch service, retry orchestration, escalation orchestration, and notification-channel service slices. |
| P7. Log center                               | `P7-log-center.md`          | Restored for the current Logs page structure slice.                                                                           |
| P8. Security and operations governance       | `P8-ops-governance.md`      | Restored for the current Execution Governance supervisor structure slice.                                                     |

## Current Use

- Each implementation slice should update the matching `P*.md` file after
  verification.
- Do not move legacy progress wholesale into this directory without checking the
  source files and TODO ledger for the current state.
