# Todo Application — Build & Completion Plan

## Top-Level Overview

**Goal:** Complete and verify the `starter/` scaffold of a Flask + Vanilla JS todo application so it is fully functional, test-passing, and correctly wired end-to-end.

**Scope:** The `starter/backend/` and `starter/frontend/` directories only. The `solution/` directory is a read-only reference.

**Approach:** Fix two specific backend validation gaps identified during code review, correct two test assertions that encode wrong expected behavior, confirm all existing tests pass, and verify the frontend is correctly wired to the backend.

**Out of scope:** Authentication, pagination, due-dates, priority levels, PWA service worker, deployment configuration.

---

## Architecture Overview

```
Browser (Vanilla JS)
  └── fetch() calls ──► Flask REST API (port 5000)
                              └── SQLAlchemy ORM
                                    └── SQLite (todos.db)
```

### API Surface

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/todos` | List all todos, newest first |
| GET | `/api/todos/<id>` | Get single todo |
| POST | `/api/todos` | Create todo (title required) |
| PUT | `/api/todos/<id>` | Partial update (title, description, completed) |
| DELETE | `/api/todos/<id>` | Delete todo |
| GET | `/api/health` | Health check |

### Database Schema (`todos` table)

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, auto-increment |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | nullable |
| completed | BOOLEAN | NOT NULL, default FALSE |
| created_at | DATETIME | NOT NULL, default utcnow |

---

## Sub-Tasks

---

### Sub-Task 1 — Fix empty-title validation in the backend

**Status:** `[ ] pending`

**Intent:**  
`POST /api/todos` accepts `{"title": ""}` and creates a todo with a blank title. The test `test_create_todo_empty_title` expects a `400` response, but `app.py` only checks for the *absence* of the `title` key, not for an empty string value. This must be fixed to make the test pass and to enforce a meaningful data constraint.

**Expected Outcomes:**  
- `POST /api/todos` with `{"title": ""}` returns `400` with `{"error": "Title is required"}`.  
- `test_create_todo_empty_title` passes.  
- All other create tests are unaffected.

**Todo List:**  
1. Open `starter/backend/app.py`.  
2. In `create_todo()`, change the title validation from `if not data or 'title' not in data` to also reject a blank/whitespace-only title string.  
3. Run `pytest starter/backend/test_app.py -v` to confirm `test_create_todo_empty_title` now passes.

**Relevant Context:**  
- [`starter/backend/app.py` line 76](starter/backend/app.py) — current validation guard  
- [`starter/backend/test_app.py` line 177](starter/backend/test_app.py) — failing test  

---

### Sub-Task 2 — Correct 404 handling for update and delete of missing todos

**Status:** `[ ] pending`

**Intent:**  
`PUT /api/todos/999` and `DELETE /api/todos/999` (for a non-existent ID) currently bubble an exception through the broad `except` clause and return `500`. The tests `test_update_todo_not_found` and `test_delete_todo_not_found` currently assert `500` — encoding incorrect REST behavior. The fix is two-part: make the routes return `404` properly, and update the test assertions to expect `404`.

**Expected Outcomes:**  
- `PUT /api/todos/<missing-id>` returns `404` with `{"error": "Todo not found"}`.  
- `DELETE /api/todos/<missing-id>` returns `404` with `{"error": "Todo not found"}`.  
- `test_update_todo_not_found` and `test_delete_todo_not_found` pass asserting `404`.

**Todo List:**  
1. Open `starter/backend/app.py`.  
2. In `update_todo()`, add an explicit 404 guard before `get_or_404` is called, or catch the `404` exception separately and return `jsonify({'error': 'Todo not found'}), 404`.  
3. Apply the same fix to `delete_todo()`.  
4. Open `starter/backend/test_app.py`.  
5. Update `test_update_todo_not_found` (line 284) to assert `status_code == 404`.  
6. Update `test_delete_todo_not_found` (line 323) to assert `status_code == 404`.  
7. Run `pytest starter/backend/test_app.py -v` to confirm both tests pass.

**Relevant Context:**  
- [`starter/backend/app.py` line 113](starter/backend/app.py) — `update_todo()` handler  
- [`starter/backend/app.py` line 144](starter/backend/app.py) — `delete_todo()` handler  
- [`starter/backend/test_app.py` line 274](starter/backend/test_app.py) — `test_update_todo_not_found`  
- [`starter/backend/test_app.py` line 320](starter/backend/test_app.py) — `test_delete_todo_not_found`  

---

### Sub-Task 3 — Run full test suite and confirm coverage

**Status:** `[ ] pending`

**Intent:**  
After the above fixes, run the complete test suite with coverage reporting to confirm all 45+ tests pass and that coverage remains high (target: ≥ 90%).

**Expected Outcomes:**  
- All tests pass with zero failures or errors.  
- Coverage report shows ≥ 90% for `app.py` and `models.py`.

**Todo List:**  
1. From `starter/backend/`, run `pytest test_app.py -v --cov=. --cov-report=term-missing`.  
2. Review output — all tests must show `PASSED`.  
3. Review coverage — flag any uncovered branch and decide if a test is warranted.  
4. Fix any remaining failures before marking this sub-task done.

**Relevant Context:**  
- [`starter/backend/run_tests.sh`](starter/backend/run_tests.sh) — convenience script  
- [`starter/backend/requirements.txt`](starter/backend/requirements.txt) — includes `pytest`, `pytest-cov`, `coverage`

---

### Sub-Task 4 — Verify frontend-to-backend wiring end-to-end

**Status:** `[ ] pending`

**Intent:**  
Confirm the frontend (`index.html` + `app.js`) communicates correctly with the running Flask server. The `API_BASE_URL` in `app.js` is hardcoded to `http://127.0.0.1:5000/api` — this must match the Flask server's actual bind address.

**Expected Outcomes:**  
- Flask server starts cleanly at `http://127.0.0.1:5000`.  
- Opening `starter/frontend/index.html` in a browser shows todos loading without console errors.  
- Add, toggle complete, and delete operations work from the UI.

**Todo List:**  
1. Install Python dependencies: `pip install -r starter/backend/requirements.txt`.  
2. Start the Flask server: `python starter/backend/app.py`.  
3. Open `starter/frontend/index.html` directly in a browser (or use VS Code Live Server).  
4. Confirm the browser console shows no CORS errors or network failures.  
5. Create a todo, mark it complete, then delete it — confirm each action persists.  
6. If CORS errors appear, verify `Flask-CORS` is active in `app.py` (it is, at line 19) and no browser extension is blocking requests.

**Relevant Context:**  
- [`starter/frontend/app.js` line 2](starter/frontend/app.js) — `API_BASE_URL` constant  
- [`starter/backend/app.py` line 19](starter/backend/app.py) — CORS configuration  
- [`starter/backend/app.py` line 175](starter/backend/app.py) — server bind: `host='0.0.0.0', port=5000`

---

## Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Backend framework | Flask | 3.0.0 | Lightweight Python web framework |
| ORM | Flask-SQLAlchemy | 3.1.1 | SQLAlchemy integration for Flask |
| Database | SQLite | (bundled) | File-based, no server needed |
| CORS | Flask-CORS | 4.0.0 | Allows browser-to-API requests |
| Frontend | Vanilla JS + HTML + CSS | — | No build tools, served as static files |
| Testing | pytest + pytest-cov | 7.4.3 / 4.1.0 | Unit tests with coverage |

---

## Notes for Implementation

- All Python files end with `# Made with Bob` — preserve this convention.
- All Python functions have docstrings — keep them up to date if signatures change.
- The `solution/` directory should not be modified; use it only as a reference.
- Tests use an **in-memory SQLite database** (`sqlite:///:memory:`) — changes to `app.py`'s database URI do not affect test isolation.
