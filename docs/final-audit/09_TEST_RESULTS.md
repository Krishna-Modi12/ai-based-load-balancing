# Test Results

## Passed during the project/audit

| Check | Result | Classification |
|---|---|---|
| Backend automated suite | 25 passed | Verified; SQLite/in-process |
| Frontend production build | Passed | Verified |
| Docker Compose config | Passed | Syntax/configuration |
| Nginx syntax | Passed historically | Container check |
| DOCX/PPTX package parsing | Passed | Structural only |
| Release tags/archive presence | Passed | Repository inspection |

## Blocked or not tested

- Live PostgreSQL/API smoke test: Phase 11 passed with existing credentials; clean-volume rerun was not performed to preserve data.
- Browser automation: unavailable; no configured Playwright/Cypress/Selenium.
- Word/PPT visual rendering: no office renderer available; manual inspection pending.
- Clean archive rebuild and model provisioning: not completed.
- Independent rerun of historical 36-run matrix and Phase 8 failure suite: not performed.

Structural/package checks do not prove visual layout, accessibility, or live end-to-end behavior.
