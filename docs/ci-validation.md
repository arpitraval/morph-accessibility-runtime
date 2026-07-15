# CI and managed-runner validation

GitHub Actions on ubuntu-latest is the release gate. It installs real Chromium and runs Playwright plus axe-core; no browser mock, skip flag, or conditional success path is permitted in CI.

The managed Windows environment used for local Codex execution may reject child-process creation with spawn EPERM. That is an execution-host limitation, not a passing browser result. In that environment:

- npm run lint, npm run typecheck, and npm run eval remain mandatory.
- Unit and red-team suites run with Node's supported in-process test isolation.
- Playwright, axe-core, Vite, and vinext failures caused specifically by spawn EPERM are recorded as environment-blocked.
- A merge is not production-green until the unchanged browser and production-build gates pass on GitHub Actions.

The Phase 9 eval runner is deterministic and is not a replacement for browser testing. Its fatal invariant is independent: any unconsented irreversible action greater than zero exits non-zero in every environment.