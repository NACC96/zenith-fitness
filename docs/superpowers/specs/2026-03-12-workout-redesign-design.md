# Workout Feature Redesign

## Problem

The current workout feature feels slow across the board. The monolithic 618-line workout page runs 3 concurrent Convex subscriptions, a 1-second `setInterval` timer, and an always-mounted 850-line AI chat overlay. Everything renders together, nothing is isolated, and the phone experience suffers.

## Goals

- Phone-first, one-handed gym use
- Near-instant set logging (swipe to confirm)
- Prominent, accurate timers
- AI chat essential but separated from tracking UI
- Start with a workout type, figure out exercises as you go

## Design

### Tab-Based Split Architecture

Replace the monolithic workout page with two swipeable tabs: **Track** and **Chat**.

Each tab lazy-loads independently. Only the visible tab renders actively. Shared state (active session ID, exercises) lives in a lightweight React context — not duplicated queries.

```text
WorkoutPage (thin shell — session lifecycle + tab state)
├── TabBar (Track | Chat, swipeable)
├── TrackTab (lazy)
│   ├── WorkoutTimer (rAF-driven, isolated renders via ref)
│   ├── ExerciseHero (current exercise + swipe-to-log)
│   └── CompletedSets (below fold, virtualized if long)
└── ChatTab (lazy)
    └── WorkoutChat (useWorkoutChat hook, context pushed on tab switch)
```

### Track Tab — Focused Layout

One exercise at a time, hero-sized. The screen shows:

- **Header**: Workout type (e.g., "Pull Day") and total elapsed time, compact.
- **Rest timer**: When resting, a large centered timer dominates the screen in amber. This is the primary visual during rest periods.
- **Exercise hero**: Current exercise name, set number, and what you did last session for reference.
- **Log button area**: Weight and reps displayed with +/- steppers for quick adjustment. Swipe right to confirm and log the set. Pre-filled from your last set's values.
- **Set progress dots**: Small dots showing completed vs remaining sets for the current exercise.
- **Completed exercises**: Below the fold, scrollable. Shows exercise name and sets summary.

### Set Logging Flow — Swipe to Confirm

1. **Resting** — rest timer counting up, prominently displayed.
2. **Adjust** — weight and reps shown with +/- stepper buttons. Values pre-filled from your previous set (or last session if first set).
3. **Swipe right to confirm** — logs the set, starts rest timer. Optimistic update — UI responds instantly, Convex mutation fires in background.

This prevents accidental taps while keeping the interaction fast. One adjustment + one swipe = set logged.

### Exercise Navigation — AI Suggests Next

After completing sets on an exercise, the AI suggests the next exercise based on your workout type history (e.g., "Next: Face Pulls?"). A subtle prompt appears that you can:

- **Tap to accept** and start logging the suggested exercise.
- **Dismiss** and pick something else (via chat or a manual search).

The suggestion comes from analyzing what exercises you typically do on this workout type, in what order. No pre-built routines to maintain.

### Chat Tab — AI Integration

Full-screen chat, accessed by swiping from the Track tab. The AI is essential for:

- Logging exercises via natural language
- Getting suggestions and adjustments mid-workout
- Asking questions about form, substitutions, etc.

**Context strategy — push on tab switch**: When the user swipes to the Chat tab, the current workout state (session info, exercises logged so far, active timers) is pushed to the AI as system context. This eliminates per-message server-side state fetches (current approach) and ensures the AI always has fresh context without added latency.

Edge case: if a set is logged via AI tool call while on the Chat tab, the context is refreshed after the tool executes.

The current AI backend (`ai.ts`, 850 lines) stays but client-side wiring is extracted into a `useWorkoutChat` hook that manages streaming state, tool execution feedback, and message history independently.

### Performance Architecture

**Timer**: Replace `setInterval` + `useState(Date.now())` with a single `requestAnimationFrame` loop writing to a ref. Only the `WorkoutTimer` component reads the ref — no re-renders propagated to siblings or parent.

**Query scoping**: Convex `useQuery` subscriptions scoped to the components that need them:
- TrackTab subscribes to exercises + timing state
- ChatTab subscribes to chat messages
- Neither pays for the other's data

**Server-side metrics**: Move volume and set count calculations into a Convex query. Currently these are computed client-side on every render. Server-side computation means the client receives final values, no recalculation.

**Lazy loading**: Each tab is a lazy-loaded component. The Chat tab (heavier due to streaming infrastructure) doesn't load until first accessed.

**Optimistic updates**: Set logging uses optimistic mutations — UI updates immediately on swipe, Convex mutation fires asynchronously. If the mutation fails, the UI rolls back.

### Session Lifecycle

**Start**: Tap "Start Workout" → pick workout type (Pull, Push, Legs, etc.) → land on Track tab with AI's first exercise suggestion ready. No routine configuration.

**During**: Track and Chat tabs available. Session persists if app is closed — reopening resumes with adjusted timers.

**End**: Tap "Finish" button (top corner) → confirmation screen with summary (duration, total volume, set count). Alternatively, tell the AI "I'm done" in chat. Session status set to "completed", duration computed from timing bounds.

## What's NOT Changing

- **Database schema**: The existing `workoutSessions`, `exercises`, and related tables are sufficient. No schema migration needed.
- **AI backend**: The `ai.ts` Convex HTTP action stays. Tool handlers stay. The streaming protocol stays.
- **Workout types**: Same concept, same table.
- **Dashboard**: Out of scope for this redesign.

## Technical Risks

- **Swipe gesture conflicts**: Tab swiping vs swipe-to-confirm logging on the Track tab. Mitigation: swipe-to-confirm is horizontal on the button element only; tab switching is a full-width gesture or tab bar tap.
- **rAF timer accuracy**: `requestAnimationFrame` doesn't fire when the tab is backgrounded. Mitigation: on visibility change, recalculate elapsed from the stored `startTime` (already in DB).
- **Optimistic update rollback**: If a Convex mutation fails after the UI has moved on. Mitigation: Convex's built-in optimistic update mechanism handles this; surface a toast on failure.
