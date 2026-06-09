# Run Backend Unit Tests Skill

Use this skill when the user asks to run backend unit tests or validate backend-only logic quickly.

## Triggers
- "run backend unit tests"
- "run unit tests for backend"
- "quick backend test check"

## Steps
1. Confirm repository root is current working directory.
2. Execute `./test_backend_unit.sh`.
3. If script prerequisites fail, report the failure reason and the required setup.
4. Return test outcome with failing test names/paths when applicable.

## Expected Output
- Command executed
- Pass/fail summary
- First actionable failure details if failed
