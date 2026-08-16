# Platform CI reusable workflow library (LiquidMovz mirror plane v2)

Source of truth: `/adapt/platform/devops/platform-ci/reusable-workflows/` (Forge kit).
Created 2026-08-16 as a FRESH repo because GitHub's actions service served a stale
content snapshot of `LiquidMovz/.github` (pre-fix rust-cache pin) to the mirror
caller regardless of ref/path. Content identical to the kit.

| Workflow | Purpose |
|---|---|
| verify-node.yml | npm ci + gitleaks + audit + types + tests + build |
| verify-rust.yml | fmt + clippy + test + build (rust-cache pinned 400e7407 = v2.7.7) |
| verify-full.yml | combined (nova-cf pattern: node + rust + contract gates) |
| jira-key.yml | PR branch/title Jira-key guard (pull_request_target) |

Tag `v1` = phase1 frozen set. Promote via the kit, retag, keep SHA pins in callers.
