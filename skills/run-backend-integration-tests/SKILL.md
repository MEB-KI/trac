# Run Backend Integration Tests Skill

Use this skill when the user asks to run backend integration tests that cover API/database interactions.

## Triggers
- "run backend integration tests"
- "run integration tests"
- "verify backend with db"

## Steps
1. Confirm repository root is current working directory.
2. Execute `./test_backend_integration.sh`.
3. If script prerequisites fail, report what service/environment is missing.
4. Return test outcome with failing test names/paths when applicable.

## Expected Output
- Command executed
- Pass/fail summary
- First actionable failure details if failed
