---
id: cloud-check-01
intent: feature
stamp: 4fe90cf38e5189d221739d48dee0c61b142b693c 2026-10-19
reads: [package.json]
---

# Cloud check: a greeting

## Context

A scratch repository for the maintainer's cloud check. The run adds one small function and its test,
and ends on a draft pull request whose body is the morning list.

## Spec delta

### REQ-GREET-001 — Greet by name (ADDED)
Given a name, Then `greet(name)` returns `Hello, <name>!`.

## Units

### u1-greet — the greeting

| Field | Content |
|---|---|
| `id` | u1-greet |
| `requirements` | REQ-GREET-001 |
| `files` | new `src/greet.mjs`, new `test/greet.test.mjs` |
| `interfaces` | `greet(name: string): string` |
| `testCriteria` | `greet('Ada')` → `Hello, Ada!` |
| `edgeCases` | an empty name → `Hello, there!` |
| `depends_on` | none |
| `verify` | `node --test test/greet.test.mjs` |

## Risks

- **Minor** — none beyond the scratch repository. Mitigation: it is deleted after the check.

## Open questions

None.
