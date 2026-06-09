# Frontend Skill

Use this skill to implement or change user-facing behavior in the TRAC frontend.

## Use When
- The request touches UI behavior, timeline interactions, locale rendering, or frontend API calls.
- The request changes files under `frontend/src/`.

## Do Not Use For
- Backend API logic, database schema/model work, or CI workflow changes.
- Running tests only (use dedicated test skills).

## Required Workflow
1. Locate impacted files in `frontend/src/` (`js/`, `pages/`, `styles/`, `locales/`, `settings/`).
2. Keep implementation in plain JavaScript/HTML/CSS. Do not add React/Vite/Webpack or runtime frontend dependencies.
3. If changing visible text, update the relevant locale files in `frontend/src/locales/`.
4. If changing API endpoints, keep `frontend/src/settings/tud_settings.js` aligned with backend pathing (`/api` or deployment-specific prefix).
5. Validate by running the smallest relevant tests. Prefer targeted E2E specs first, then broader suites if needed.
6. Summarize changed files, behavior impact, and what was tested.

## Quality Checks
- Timeline interactions still align to 10-minute blocks.
- Language fallback behavior remains intact.
- No bundler/tooling changes introduced into delivery path.
