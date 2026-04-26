# Zenith Fitness Code Review Fixes Implementation Plan

> **For Hermes:** Implement this plan task-by-task, using TDD for pure helpers and running verification after each group of changes.

**Goal:** Fix the security, correctness, validation, cleanup, and maintainability issues found in the Zenith Fitness code review.

**Architecture:** Add small pure helper modules for HTTP security and workout validation so behavior can be unit-tested without booting Convex. Then wire those helpers into Convex HTTP actions/mutations, improve query semantics, and clean lint/tooling issues. Full multi-user auth requires a product decision/provider setup; this pass will harden the public endpoint with origin checks, model allowlisting, payload limits, and clearer server-side boundaries without introducing a login flow.

**Tech Stack:** Next.js 15, React 19, TypeScript, Convex, OpenRouter, Node built-in test runner.

---

## Task 1: Add lightweight test infrastructure

**Objective:** Add a `npm test` command that compiles focused TypeScript helper tests to a temporary directory and runs them with Node's built-in test runner.

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `tests/`

**Verification:**
- `npm test` should run after helper tests exist.

## Task 2: Add and test HTTP security helpers

**Objective:** Create pure helpers for CORS origin allowlisting, model allowlisting, and chat payload validation.

**Files:**
- Create: `convex/lib/httpSecurity.ts`
- Create: `tests/httpSecurity.test.ts`

**Behaviors:**
- Allowed origins: configured origins, localhost development origins, empty origin for same-origin/server-to-server requests.
- Disallowed origins return false.
- Only server allowlisted model IDs pass.
- Content length, message history count/length, image count, and image size are capped.

**Verification:**
- Run the specific compiled test command via `npm test`.

## Task 3: Wire HTTP security into `/api/chat`

**Objective:** Enforce origin, method/payload, model, and image/text limits before calling OpenRouter or executing tools.

**Files:**
- Modify: `convex/ai.ts`
- Modify: `convex/http.ts` if needed for OPTIONS headers

**Verification:**
- `npx tsc --noEmit`
- `npm run build`

## Task 4: Add and test workout set validation helpers

**Objective:** Centralize validation for weights, reps, set arrays, dates, and workout/exercise labels.

**Files:**
- Create: `convex/lib/workoutValidation.ts`
- Create: `tests/workoutValidation.test.ts`

**Behaviors:**
- Reject negative/non-finite weights.
- Reject fractional/zero/negative reps.
- Reject empty set arrays where a logged exercise requires at least one set.
- Trim/cap non-empty names/types.
- Validate ISO date strings for logExercise session creation.

## Task 5: Wire workout validation into mutations and AI tool handlers

**Objective:** Prevent bad AI/UI calls from corrupting workout data.

**Files:**
- Modify: `convex/exercises.ts`
- Modify: `convex/workoutSessions.ts`
- Modify: `convex/workoutTypes.ts`
- Modify: `convex/ai.ts`

**Verification:**
- `npm test`
- `npx tsc --noEmit`

## Task 6: Fix workout history/stats semantics and ordering

**Objective:** Use the `by_date` and `by_type` indexes where appropriate, and stop calling recent-only stats “all-time”.

**Files:**
- Modify: `convex/workoutSessions.ts`
- Modify: `convex/ai.ts`

**Changes:**
- `listAll` / `listRecent`: order by `by_date` if workout date semantics are desired.
- Add a `listRecentByType` query for type-filtered history.
- Rename AI stat outputs to recent/current-window stats unless implementing a true all-time query.

## Task 7: Cleanup lint/tooling/package manager issues

**Objective:** Remove low-risk lint warnings and make package manager intent clear.

**Files:**
- Modify: `src/components/workout/ChatTab.tsx`
- Modify: `src/components/ChatDrawer.tsx`
- Modify: `package.json`
- Remove one lockfile only if safe after confirming installed package manager usage.

**Changes:**
- Remove unused `session` variable.
- Fix or explicitly document the intentional ChatDrawer dependency omission.
- Replace deprecated `next lint` with `eslint .`.
- Add `.test-build/` to `.gitignore`.

## Task 8: Final verification

**Objective:** Prove the repo remains healthy.

**Commands:**
- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git status --short --branch`

**Expected:** All pass, except any clearly documented package-manager/audit command limitations.
