# Run Frontend E2E Tests Skill

Use this skill when the user asks to run frontend end-to-end tests or validate full user flows.

## Triggers
- "run frontend tests"
- "run e2e tests"
- "verify ui flow"

## Steps
1. Confirm repository root is current working directory.
2. Execute `./test_e2e.sh`.
3. If script prerequisites fail, report the missing running services/setup.
4. Return test outcome with failing spec paths when applicable.

## Expected Output
- Command executed
- Pass/fail summary
- First actionable failure details if failed
