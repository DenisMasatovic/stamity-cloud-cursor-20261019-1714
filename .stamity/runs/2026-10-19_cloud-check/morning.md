# Morning list — 2026-10-19_cloud-check

## Refused

- **direct-push** — `stamity gate preflight --unattended --json` exited 1. The origin's push URL for
  DenisMasatovic/stamity-cloud-cursor-20261019-1714 carries its own credentials, so the pre-flight cannot tie it to
  gh's identity, and its REST reads prove nothing about who pushes. Fix: use an https origin with `gh auth setup-git`.

## For you to check

none

## Decisions

none

## Prerequisites

none

## Person's calls held

none

## Not done:

- u1-greet (REQ-GREET-001): `src/greet.mjs` and `test/greet.test.mjs` were not built. The run stopped at the pre-flight.
- The ready check (`stamity plan check`) did not run.

## How to answer

Fix the origin as the refusal names, then start a new unattended run:
`/st-work --unattended docs/plans/001-cloud-check.md (run contract: run-contract.yml)`.

```stamity-morning
{"id":"Q1","kind":"prerequisite","question":"How should the push identity be settled before the re-run?","options":["Repoint origin to https with gh auth setup-git","Accept the credentialed push URL and change the pre-flight policy"],"default":1,"source":"pre-flight direct-push"}
```
