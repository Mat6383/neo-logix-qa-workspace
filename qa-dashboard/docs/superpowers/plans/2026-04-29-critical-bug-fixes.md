# Critical Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 critical bugs identified in the audit: NaN in milestone parsing, XSS via marked.parse, and N+1 notes fetch in status-sync.

**Architecture:** Each bug is isolated to a single file/function. No cross-cutting changes. Tests first (TDD), then implementation.

**Tech Stack:** Node.js/Express backend, Jest tests, `sanitize-html` (new dependency for XSS fix).

---

## Task 1: Fix NaN propagation in parseMilestones

**Files:**
- Modify: `backend/controllers/dashboard.controller.js:4-6`
- Test: `backend/tests/critical-bugs.test.js` (create)

**Problem:** `query.split(',').map(Number)` — `Number('abc')` returns `NaN`, which silently corrupts metric calculations downstream.

- [x] **Step 1: Write the failing test**

```js
// backend/tests/critical-bugs.test.js
const { parseMilestones } = require('../controllers/dashboard.controller');

describe('parseMilestones', () => {
  test('retourne null pour entrée vide', () => {
    expect(parseMilestones(null)).toBeNull();
    expect(parseMilestones(undefined)).toBeNull();
  });

  test('parse des IDs valides', () => {
    expect(parseMilestones('1,2,3')).toEqual([1, 2, 3]);
  });

  test('filtre silencieusement les chaînes invalides (NaN)', () => {
    expect(parseMilestones('1,abc,3')).toEqual([1, 3]);
  });

  test('retourne null si tous les IDs sont invalides', () => {
    expect(parseMilestones('abc,xyz')).toBeNull();
  });

  test('filtre les nombres non-positifs', () => {
    expect(parseMilestones('1,-2,0,3')).toEqual([1, 3]);
  });

  test('gère les espaces autour des IDs', () => {
    expect(parseMilestones(' 1 , 2 , 3 ')).toEqual([1, 2, 3]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/critical-bugs.test.js --testNamePattern="parseMilestones" 2>&1 | tail -5
```
Expected: FAIL — `parseMilestones` not exported from `dashboard.controller`.

- [x] **Step 3: Fix + export parseMilestones**

```js
// dashboard.controller.js — remplacer lines 4-6
function parseMilestones(query) {
  if (!query) return null;
  const ids = query.split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : null;
}
```

And add to module.exports: `module.exports = { getMetrics, getQualityRates, getAnnualTrends, parseMilestones };`

- [x] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/critical-bugs.test.js 2>&1 | tail -10
```
Expected: 6/6 PASS

- [x] **Step 5: Commit**

```bash
git add backend/controllers/dashboard.controller.js backend/tests/critical-bugs.test.js
git commit -m "fix(dashboard): filter NaN from milestone query params"
```

---

## Task 2: Sanitize marked.parse output (XSS)

**Files:**
- Modify: `backend/services/sync.service.js:79,167`
- Test: `backend/tests/critical-bugs.test.js` (append)

**Problem:** `marked.parse(description)` and `marked.parse(noteContent)` convert Markdown to HTML without sanitization. A GitLab issue description containing `<script>alert(1)</script>` or `<img src=x onerror=...>` would be stored as-is in Testmo and rendered in the PDF export.

- [x] **Step 1: Install sanitize-html**

```bash
cd backend && npm install sanitize-html
```
Expected: package added to package.json + package-lock.json.

- [x] **Step 2: Write the failing test**

Append to `backend/tests/critical-bugs.test.js`:

```js
const syncService = require('../services/sync.service');

describe('XSS sanitization — _extractStepsFromNotes', () => {
  test('supprime les balises script', () => {
    const notes = [{ body: '[TEST]\n<script>alert(1)</script>\ncontenu', system: false }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].text1).not.toContain('<script>');
    expect(steps[0].text1).not.toContain('alert(1)');
  });

  test('supprime les attributs onerror', () => {
    const notes = [{ body: '[TEST]\n<img src=x onerror="alert(1)">\ncontenu', system: false }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].text1).not.toContain('onerror');
  });

  test('conserve le contenu légitime', () => {
    const notes = [{ body: '[PRÉREQUIS]\nVérifier la connexion\n[TEST]\nCliquer sur le bouton' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps.some(s => s.text1.includes('Vérifier') || s.text1.includes('Cliquer'))).toBe(true);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

```bash
cd backend && npx jest tests/critical-bugs.test.js --testNamePattern="XSS" 2>&1 | tail -10
```
Expected: FAIL — `<script>` tag not removed.

- [x] **Step 4: Add sanitizeHtml to sync.service.js**

Add at top of file (line 19, after `const { marked } = require('marked');`):
```js
const sanitizeHtml = require('sanitize-html');
```

In `_buildCasePayloadWith` (line 79), change:
```js
custom_description: description ? sanitizeHtml(marked.parse(description.substring(0, 4000))) : '',
```

In `_extractStepsFromNotes` (line 167), change:
```js
text1: sanitizeHtml(marked.parse(`**[${s.label}]**\n\n${s.content}`)),
```

- [x] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest tests/critical-bugs.test.js 2>&1 | tail -10
```
Expected: all PASS

- [x] **Step 6: Commit**

```bash
git add backend/services/sync.service.js backend/package.json backend/package-lock.json backend/tests/critical-bugs.test.js
git commit -m "fix(sync): sanitize marked.parse output to prevent XSS"
```

---

## Task 3: Fix N+1 notes fetch in status-sync

**Files:**
- Modify: `backend/services/status-sync.service.js`
- Test: `backend/tests/critical-bugs.test.js` (append)

**Problem:** `_postCommentIfNeeded` calls `gitlabService.getIssueNotes(iid)` inside the main loop. For 100 results → 100 sequential notes-fetch API calls, each adding `apiDelay` (400ms) latency. Total: 40+ seconds of avoidable serial I/O.

**Fix:** Pre-fetch notes for all matched issues in parallel (batches of 5) before the loop, then pass the cache to `_postCommentIfNeeded`.

- [x] **Step 1: Write the failing test**

Append to `backend/tests/critical-bugs.test.js`:

```js
const { StatusSyncService } = require('../services/status-sync.service');

describe('StatusSync — pre-fetch notes (no N+1)', () => {
  test('getIssueNotes est appelé avant updateWorkItemStatus', async () => {
    const callOrder = [];

    const mockGitlab = {
      findIterationForProject: async () => ({ id: 42 }),
      getIssuesForIteration: async () => [
        { id: 100, iid: 1, title: 'Case A' },
        { id: 101, iid: 2, title: 'Case B' }
      ],
      getIssueNotes: async (_, iid) => { callOrder.push(`notes:${iid}`); return []; },
      updateWorkItemStatus: async (gid) => { callOrder.push(`update:${gid}`); },
      addIssueComment: async () => {}
    };

    const service = new StatusSyncService();
    service._getRunInfo = async () => ({ name: 'Run 1' });
    service._getRunResults = async () => [
      { case_id: 1, case_name: 'Case A', status_id: 2, is_latest: true },
      { case_id: 2, case_name: 'Case B', status_id: 3, is_latest: true }
    ];
    service._getCaseNames = async () => new Map([[1, 'Case A'], [2, 'Case B']]);

    const originalGitlab = require('../services/gitlab.service');
    Object.assign(originalGitlab, mockGitlab);

    await service.syncRunStatusToGitLab(99, 'R01 - run 1', '123', () => {}, false);

    // Tous les notes: doivent être appelés avant tous les update:
    const lastNotesIndex  = Math.max(...callOrder.map((c, i) => c.startsWith('notes:')  ? i : -1));
    const firstUpdateIndex = Math.min(...callOrder.map((c, i) => c.startsWith('update:') ? i : Infinity));

    expect(lastNotesIndex).toBeLessThan(firstUpdateIndex);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/critical-bugs.test.js --testNamePattern="pre-fetch" 2>&1 | tail -10
```
Expected: FAIL — notes called after updates in current sequential loop.

- [x] **Step 3: Add cachedNotes pre-fetch to syncRunStatusToGitLab**

In `status-sync.service.js`, modify `_postCommentIfNeeded` signature:
```js
async _postCommentIfNeeded(projectId, issueIid, caseName, runName, statusId, cachedNotes = null) {
  const commentText = this._buildCommentText(runName, statusId);
  try {
    const existingNotes = cachedNotes?.get(issueIid) ?? await gitlabService.getIssueNotes(projectId, issueIid);
    const alreadyExists = existingNotes.some(n => n.body === commentText);
    if (alreadyExists) {
      logger.info(`[StatusSync] Commentaire déjà présent sur #${issueIid} — ignoré`);
      return;
    }
    await gitlabService.addIssueComment(projectId, issueIid, commentText);
    logger.info(`[StatusSync] Commentaire ajouté sur #${issueIid} "${caseName}"`);
  } catch (err) {
    logger.error(`[StatusSync] Erreur commentaire #${issueIid} "${caseName}": ${err.message}`);
  }
}
```

In `syncRunStatusToGitLab`, add the pre-fetch block after `issueByTitle` is built (after line ~341):
```js
// Pré-charger les notes GitLab pour toutes les issues matchées (élimine le N+1)
const cachedNotes = new Map();
if (!dryRun) {
  onEvent('info', { message: 'Pré-chargement des commentaires GitLab…' });
  const issueIidsToFetch = [];
  for (const r of results) {
    if (!STATUS_TO_GITLAB_STATUS[r.status_id]) continue;
    const cn = r.case_name || caseNames.get(r.case_id);
    if (!cn) continue;
    const iss = issueByTitle.get(normalize(cn));
    if (iss) issueIidsToFetch.push(iss.iid);
  }

  const CONCURRENCY = 5;
  for (let i = 0; i < issueIidsToFetch.length; i += CONCURRENCY) {
    const batch = issueIidsToFetch.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async iid => {
      try {
        cachedNotes.set(iid, await gitlabService.getIssueNotes(gitlabProjectId, iid));
      } catch (err) {
        logger.warn(`[StatusSync] Impossible de charger les notes pour #${iid}: ${err.message}`);
        cachedNotes.set(iid, []);
      }
    }));
  }
  onEvent('info', { message: `${cachedNotes.size} cache(s) de commentaires chargé(s).` });
}
```

Pass `cachedNotes` in the loop:
```js
await this._postCommentIfNeeded(gitlabProjectId, issue.iid, caseName, runName, statusId, cachedNotes);
```

- [x] **Step 4: Run all tests**

```bash
cd backend && npx jest 2>&1 | tail -15
```
Expected: 285+ tests pass, 0 failures.

- [x] **Step 5: Commit**

```bash
git add backend/services/status-sync.service.js backend/tests/critical-bugs.test.js
git commit -m "fix(status-sync): pre-fetch GitLab notes before loop to eliminate N+1"
```

---

## Task 4: Create IMPROVEMENTS.md tracking file

**Files:**
- Create: `IMPROVEMENTS.md` (project root)

- [x] **Step 1: Create the file** with all 15 audit findings organized by category, each with priority and status.

- [x] **Step 2: Update memory** to reference this file for future sessions.

---

## Self-Review

- [x] NaN fix covers null, undefined, empty string, valid ints, floats (via parseInt radix), negative, zero
- [x] XSS fix covers both call sites (`_buildCasePayloadWith` and `_extractStepsFromNotes`)
- [x] N+1 fix handles dryRun case (skip pre-fetch), API errors (fallback to empty), and passes cache through
- [x] All 3 tasks are testable via Jest without external services
