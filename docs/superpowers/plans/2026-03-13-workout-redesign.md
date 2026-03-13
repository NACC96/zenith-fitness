# Workout Feature Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic workout page with a phone-first, tab-based split (Track + Chat) featuring swipe-to-confirm set logging, rAF-driven timers, and scoped Convex subscriptions.

**Architecture:** Two lazy-loaded tabs share session state via a lightweight React context. The Track tab uses a focused layout (one exercise at a time, swipe-to-confirm logging). The Chat tab pushes workout context on tab switch instead of fetching per-message. Timer renders are isolated via `requestAnimationFrame` + refs.

**Tech Stack:** Next.js 15, React 19, Convex, Framer Motion, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-12-workout-redesign-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/contexts/WorkoutContext.tsx` | Shared workout state (active session, exercises, timing) via React context |
| `src/hooks/useAnimationTimer.ts` | rAF-driven timer that writes to a ref, returns formatted string without causing re-renders |
| `src/hooks/useWorkoutChat.ts` | Extracted chat logic: SSE streaming, tool execution feedback, message state |
| `src/components/workout/TabBar.tsx` | Track/Chat tab switcher with swipe gesture support |
| `src/components/workout/TrackTab.tsx` | Track tab container: timer, exercise hero, completed sets |
| `src/components/workout/WorkoutTimer.tsx` | Isolated timer display reading from rAF ref |
| `src/components/workout/ExerciseHero.tsx` | Current exercise display with swipe-to-confirm logging |
| `src/components/workout/SwipeConfirm.tsx` | Reusable swipe-right-to-confirm gesture component |
| `src/components/workout/CompletedSets.tsx` | Scrollable completed exercises list below the fold |
| `src/components/workout/ChatTab.tsx` | Chat tab: full-screen chat with context push on mount |
| `src/components/workout/ExerciseSuggestion.tsx` | AI exercise suggestion prompt ("Next: Face Pulls?") |
| `convex/workoutMetrics.ts` | Server-side volume and set count computation |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/workout/page.tsx` | Complete rewrite — thin shell with session lifecycle, tab state, and WorkoutContext provider |
| `convex/workoutSessions.ts` | Add `getSessionMetrics` query for server-side metrics |
| `convex/ai.ts` | Add `suggestNextExercise` tool handler |

### Files to Remove After Rewrite

| File | Reason |
|------|--------|
| `src/components/WorkoutFocusPanel.tsx` | Replaced by WorkoutTimer + ExerciseHero |
| `src/components/WorkoutChatOverlay.tsx` | Replaced by ChatTab + useWorkoutChat hook |
| `src/components/ActiveExerciseFeed.tsx` | Replaced by CompletedSets (appears unused already) |

---

## Chunk 1: Foundation — Context, Timer Hook, Swipe Gesture

### Task 1: Create WorkoutContext

Provides shared state so Track and Chat tabs can access session data without duplicating Convex subscriptions.

**Files:**
- Create: `src/contexts/WorkoutContext.tsx`

- [ ] **Step 1: Create the context file**

```tsx
// src/contexts/WorkoutContext.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface WorkoutContextValue {
  // Session
  session: ReturnType<typeof useQuery<typeof api.workoutSessions.getActive>> | undefined;
  sessionId: Id<"workoutSessions"> | null;

  // Exercises
  exercises: ReturnType<typeof useQuery<typeof api.exercises.listBySession>> | undefined;

  // Timing
  timingState: ReturnType<typeof useQuery<typeof api.workoutSessions.getLiveTimingState>> | undefined;

  // Mutations
  completeSet: ReturnType<typeof useMutation<typeof api.exercises.completeSet>>;
  startSet: ReturnType<typeof useMutation<typeof api.exercises.startSet>>;
  finishWorkout: ReturnType<typeof useMutation<typeof api.workoutSessions.finishActive>>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}

export function WorkoutProvider({
  sessionId,
  children,
}: {
  sessionId: Id<"workoutSessions"> | null;
  children: ReactNode;
}) {
  const session = useQuery(
    api.workoutSessions.getActive
  );
  const exercises = useQuery(
    api.exercises.listBySession,
    sessionId ? { sessionId } : "skip"
  );
  const timingState = useQuery(
    api.workoutSessions.getLiveTimingState,
    sessionId ? { sessionId } : "skip"
  );

  const completeSet = useMutation(api.exercises.completeSet);
  const startSet = useMutation(api.exercises.startSet);
  const finishWorkout = useMutation(api.workoutSessions.finishActive);

  return (
    <WorkoutContext.Provider
      value={{
        session,
        sessionId,
        exercises,
        timingState,
        completeSet,
        startSet,
        finishWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}
```

Note: The exact return types from `useQuery` depend on Convex codegen. The types above are illustrative — use the actual generated types. Check `convex/_generated/api.ts` for the precise signatures.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx tsc --noEmit src/contexts/WorkoutContext.tsx`

If TypeScript can't check a single file this way, run: `npx next lint` to catch obvious errors. Adjust types as needed based on Convex codegen output.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/WorkoutContext.tsx
git commit -m "feat(workout): add WorkoutContext for shared session state"
```

---

### Task 2: Create useAnimationTimer Hook

Drives the workout timer display using `requestAnimationFrame` instead of `setInterval`. Writes to a ref so only the timer component re-renders, not the entire tree.

**Files:**
- Create: `src/hooks/useAnimationTimer.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useAnimationTimer.ts
"use client";

import { useRef, useEffect, useCallback } from "react";

/**
 * Returns a ref whose `.current` is the formatted timer string (e.g., "24:31").
 * Uses requestAnimationFrame to update ~60fps without causing React re-renders.
 * The consumer component should read `.current` inside its own rAF or
 * use the provided `subscribe` to trigger targeted re-renders.
 */
export function useAnimationTimer(startTimeMs: number | null | undefined) {
  const displayRef = useRef("00:00");
  const rafRef = useRef<number>(0);
  const callbacksRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((cb: () => void) => {
    callbacksRef.current.add(cb);
    return () => {
      callbacksRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!startTimeMs) {
      displayRef.current = "00:00";
      return;
    }

    let lastFormatted = "";

    function tick() {
      const elapsed = Math.max(0, Date.now() - startTimeMs!);
      const totalSec = Math.floor(elapsed / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      const formatted = `${min}:${sec.toString().padStart(2, "0")}`;

      if (formatted !== lastFormatted) {
        lastFormatted = formatted;
        displayRef.current = formatted;
        callbacksRef.current.forEach((cb) => cb());
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [startTimeMs]);

  return { displayRef, subscribe };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnimationTimer.ts
git commit -m "feat(workout): add rAF-driven timer hook"
```

---

### Task 3: Create SwipeConfirm Component

A reusable swipe-right-to-confirm gesture component used for logging sets.

**Files:**
- Create: `src/components/workout/SwipeConfirm.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/SwipeConfirm.tsx
"use client";

import { useRef, useState, useCallback, ReactNode } from "react";

interface SwipeConfirmProps {
  onConfirm: () => void;
  children: ReactNode;
  threshold?: number; // percentage of width to trigger (default 60)
  disabled?: boolean;
}

export default function SwipeConfirm({
  onConfirm,
  children,
  threshold = 60,
  disabled = false,
}: SwipeConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const confirmedRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      confirmedRef.current = false;
      startXRef.current = e.touches[0].clientX;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || disabled) return;
      const dx = Math.max(0, e.touches[0].clientX - startXRef.current);
      setDragX(dx);
    },
    [isDragging, disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);

    const containerWidth = containerRef.current?.offsetWidth ?? 300;
    const pct = (dragX / containerWidth) * 100;

    if (pct >= threshold && !confirmedRef.current) {
      confirmedRef.current = true;
      onConfirm();
    }

    setDragX(0);
  }, [isDragging, disabled, dragX, threshold, onConfirm]);

  const containerWidth = containerRef.current?.offsetWidth ?? 300;
  const pct = (dragX / containerWidth) * 100;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-0 rounded-xl transition-colors"
        style={{
          background: pct >= threshold
            ? "rgba(34, 197, 94, 0.3)"
            : "rgba(37, 99, 235, 0.2)",
          width: `${Math.min(pct, 100)}%`,
        }}
      />

      {/* Content */}
      <div className="relative">{children}</div>

      {/* Arrow hint */}
      {!isDragging && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">
          →
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/SwipeConfirm.tsx
git commit -m "feat(workout): add SwipeConfirm gesture component"
```

---

## Chunk 2: Track Tab Components

### Task 4: Create WorkoutTimer Component

Isolated timer display that reads from the rAF hook. Only this component re-renders on timer ticks.

**Files:**
- Create: `src/components/workout/WorkoutTimer.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/WorkoutTimer.tsx
"use client";

import { useSyncExternalStore } from "react";
import { useAnimationTimer } from "@/hooks/useAnimationTimer";
import { useWorkout } from "@/contexts/WorkoutContext";

type TimerMode = "elapsed" | "rest";

interface WorkoutTimerProps {
  mode: TimerMode;
}

export default function WorkoutTimer({ mode }: WorkoutTimerProps) {
  const { timingState } = useWorkout();

  const startTime =
    mode === "rest"
      ? timingState?.activeRestStartedAt
      : timingState?.firstSetStartedAt;

  const { displayRef, subscribe } = useAnimationTimer(startTime ?? null);

  // useSyncExternalStore subscribes to the rAF updates
  const display = useSyncExternalStore(
    subscribe,
    () => displayRef.current,
    () => "00:00" // server snapshot
  );

  const isRest = mode === "rest";

  return (
    <div className="text-center">
      {isRest && (
        <div className="text-sm text-amber-400 mb-1">RESTING</div>
      )}
      <div
        className={`font-bold tabular-nums tracking-tighter ${
          isRest ? "text-6xl text-amber-400" : "text-5xl text-white"
        }`}
      >
        {display}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/WorkoutTimer.tsx
git commit -m "feat(workout): add rAF-driven WorkoutTimer component"
```

---

### Task 5: Create ExerciseHero Component

Shows the current exercise with weight/reps steppers and swipe-to-confirm.

**Files:**
- Create: `src/components/workout/ExerciseHero.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/ExerciseHero.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import SwipeConfirm from "./SwipeConfirm";

interface ExerciseHeroProps {
  exerciseName: string;
  lastWeight: number | null;
  lastReps: number | null;
  setNumber: number;
}

export default function ExerciseHero({
  exerciseName,
  lastWeight,
  lastReps,
  setNumber,
}: ExerciseHeroProps) {
  const { completeSet, sessionId } = useWorkout();

  const [weight, setWeight] = useState(lastWeight ?? 135);
  const [reps, setReps] = useState(lastReps ?? 8);

  // Sync defaults when exercise changes
  const exerciseKey = exerciseName;
  const [prevKey, setPrevKey] = useState(exerciseKey);
  if (exerciseKey !== prevKey) {
    setPrevKey(exerciseKey);
    setWeight(lastWeight ?? 135);
    setReps(lastReps ?? 8);
  }

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    await completeSet({
      sessionId,
      exerciseName,
      weight,
      reps,
    });
  }, [sessionId, exerciseName, weight, reps, completeSet]);

  const weightStep = useMemo(() => (weight < 50 ? 2.5 : 5), [weight]);

  return (
    <div className="px-4">
      {/* Exercise name */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">{exerciseName}</h2>
        <p className="text-sm text-zinc-500">
          Set {setNumber}
          {lastWeight != null && ` · Last: ${lastWeight}×${lastReps}`}
        </p>
      </div>

      {/* Steppers */}
      <div className="flex justify-center items-center gap-6 mb-6">
        {/* Weight stepper */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeight((w) => Math.max(0, w - weightStep))}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            −
          </button>
          <div className="text-center w-16">
            <div className="text-2xl font-bold text-white tabular-nums">
              {weight}
            </div>
            <div className="text-xs text-zinc-500">lbs</div>
          </div>
          <button
            onClick={() => setWeight((w) => w + weightStep)}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            +
          </button>
        </div>

        <span className="text-zinc-600 text-xl">×</span>

        {/* Reps stepper */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReps((r) => Math.max(1, r - 1))}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            −
          </button>
          <div className="text-center w-8">
            <div className="text-2xl font-bold text-white tabular-nums">
              {reps}
            </div>
            <div className="text-xs text-zinc-500">reps</div>
          </div>
          <button
            onClick={() => setReps((r) => r + 1)}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            +
          </button>
        </div>
      </div>

      {/* Swipe to confirm */}
      <SwipeConfirm onConfirm={handleConfirm}>
        <div className="bg-blue-600 rounded-xl py-5 text-center">
          <div className="font-bold text-lg text-white">
            Log {weight} × {reps}
          </div>
          <div className="text-xs text-blue-300 mt-1">
            Swipe right to confirm
          </div>
        </div>
      </SwipeConfirm>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/ExerciseHero.tsx
git commit -m "feat(workout): add ExerciseHero with stepper and swipe-to-confirm"
```

---

### Task 6: Create CompletedSets Component

Shows completed exercises below the fold. Lightweight, scrollable.

**Files:**
- Create: `src/components/workout/CompletedSets.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/CompletedSets.tsx
"use client";

import { useWorkout } from "@/contexts/WorkoutContext";
import { formatNum } from "@/lib/utils";

export default function CompletedSets() {
  const { exercises } = useWorkout();

  if (!exercises || exercises.length === 0) return null;

  // Filter to exercises with at least one completed set
  const completed = exercises.filter((ex) => ex.sets.length > 0);

  if (completed.length === 0) return null;

  return (
    <div className="px-4 mt-6">
      <div className="text-xs text-zinc-600 uppercase tracking-wide mb-2">
        Completed
      </div>
      <div className="bg-zinc-900 rounded-xl divide-y divide-zinc-800">
        {completed.map((ex) => (
          <div
            key={ex._id}
            className="flex justify-between items-center px-4 py-3"
          >
            <span className="text-sm text-white">{ex.name}</span>
            <span className="text-sm text-zinc-500">
              {ex.sets.length} × {formatNum(ex.sets[0]?.weight ?? 0)}×
              {ex.sets[0]?.reps ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/CompletedSets.tsx
git commit -m "feat(workout): add CompletedSets list component"
```

---

### Task 7: Create ExerciseSuggestion Component

Shows AI-suggested next exercise after completing an exercise.

**Files:**
- Create: `src/components/workout/ExerciseSuggestion.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/ExerciseSuggestion.tsx
"use client";

interface ExerciseSuggestionProps {
  suggestion: string | null;
  onAccept: (exerciseName: string) => void;
  onDismiss: () => void;
}

export default function ExerciseSuggestion({
  suggestion,
  onAccept,
  onDismiss,
}: ExerciseSuggestionProps) {
  if (!suggestion) return null;

  return (
    <div className="px-4 mt-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-500 mb-2">NEXT UP</div>
        <div className="flex items-center justify-between">
          <span className="text-white font-medium">{suggestion}?</span>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-zinc-500 rounded-lg active:bg-zinc-800"
            >
              Skip
            </button>
            <button
              onClick={() => onAccept(suggestion)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg active:bg-blue-700"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/ExerciseSuggestion.tsx
git commit -m "feat(workout): add ExerciseSuggestion prompt component"
```

---

### Task 8: Create TrackTab

Container that composes timer, exercise hero, suggestion, and completed sets.

**Files:**
- Create: `src/components/workout/TrackTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/TrackTab.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import WorkoutTimer from "./WorkoutTimer";
import ExerciseHero from "./ExerciseHero";
import ExerciseSuggestion from "./ExerciseSuggestion";
import CompletedSets from "./CompletedSets";

export default function TrackTab() {
  const { session, exercises, timingState, startSet, sessionId } = useWorkout();
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const activeSet = session?.activeSet ?? null;
  const isResting = session?.activeRestStartedAt != null;

  // Determine current exercise context
  const currentExercise = useMemo(() => {
    if (activeSet) {
      // Find last set info for this exercise
      const ex = exercises?.find(
        (e) => e.name.toLowerCase() === activeSet.exerciseName.toLowerCase()
      );
      const lastSet = ex?.sets[ex.sets.length - 1];
      return {
        name: activeSet.exerciseName,
        lastWeight: lastSet?.weight ?? activeSet.weight ?? null,
        lastReps: lastSet?.reps ?? null,
        setNumber: (ex?.sets.length ?? 0) + 1,
      };
    }
    return null;
  }, [activeSet, exercises]);

  const handleAcceptSuggestion = useCallback(
    async (exerciseName: string) => {
      if (!sessionId) return;
      await startSet({ sessionId, exerciseName });
      setSuggestion(null);
    },
    [sessionId, startSet]
  );

  const handleDismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <span className="text-sm text-zinc-500">
          {session?.type ?? "Workout"}
        </span>
        {!isResting && (
          <span className="text-sm text-zinc-500">
            <WorkoutTimer mode="elapsed" />
          </span>
        )}
      </div>

      {/* Rest timer or elapsed timer */}
      <div className="py-6">
        {isResting ? (
          <WorkoutTimer mode="rest" />
        ) : (
          <WorkoutTimer mode="elapsed" />
        )}
      </div>

      {/* Exercise hero or suggestion */}
      {currentExercise ? (
        <ExerciseHero
          exerciseName={currentExercise.name}
          lastWeight={currentExercise.lastWeight}
          lastReps={currentExercise.lastReps}
          setNumber={currentExercise.setNumber}
        />
      ) : (
        <ExerciseSuggestion
          suggestion={suggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      {/* Completed exercises */}
      <CompletedSets />
    </div>
  );
}
```

Note: The `suggestion` state is a placeholder. In Task 15, we'll replace this with a Convex query (`exerciseSuggestions.suggestNext`) that provides AI-driven suggestions based on workout type history. For now, it starts as `null` and the suggestion UI only appears when set.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/TrackTab.tsx
git commit -m "feat(workout): add TrackTab container component"
```

---

## Chunk 3: Chat Tab and useWorkoutChat Hook

### Task 9: Extract useWorkoutChat Hook

Extract the SSE streaming, tool execution, and message management from the current `WorkoutChatOverlay.tsx` (903 lines) and `page.tsx` `handleSend` (lines 204-328) into a standalone hook.

**Files:**
- Create: `src/hooks/useWorkoutChat.ts`
- Reference: `src/app/workout/page.tsx:204-328` (handleSend), `src/components/WorkoutChatOverlay.tsx`

- [ ] **Step 1: Create the hook**

Extract the streaming logic from `page.tsx` lines 204-328 into a self-contained hook. The hook manages:
- `messages` state (chat history)
- `isStreaming` state
- `streamingContent` state
- `selectedModel` state
- `sendMessage(content, images?)` — fires SSE request, parses stream, handles tool results
- `pushContext(workoutState)` — updates the system context sent with messages

```ts
// src/hooks/useWorkoutChat.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

interface UseWorkoutChatOptions {
  sessionId: Id<"workoutSessions"> | null;
  chatSessionId: Id<"chatSessions"> | null;
}

export function useWorkoutChat({ sessionId, chatSessionId }: UseWorkoutChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-sonnet-4-6");
  const workoutContextRef = useRef<string>("");
  const convex = useConvex();

  const messages = useQuery(
    api.chatMessages.list,
    chatSessionId ? { sessionId: chatSessionId } : "skip"
  );

  const sendChatMessage = useMutation(api.chatMessages.send);

  const pushContext = useCallback((workoutState: string) => {
    workoutContextRef.current = workoutState;
  }, []);

  const sendMessage = useCallback(
    async (content: string, images?: string[]) => {
      if (!chatSessionId || isStreaming) return;

      // Save user message
      await sendChatMessage({
        sessionId: chatSessionId,
        role: "user",
        content,
        images: images ?? [],
      });

      setIsStreaming(true);
      setStreamingContent("");

      try {
        // Build message history (last 20, strip images for payload size)
        const history = (messages ?? []).slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        history.push({ role: "user" as const, content });

        // SSE streaming request to Convex HTTP action
        // This mirrors the existing handleSend logic from page.tsx:204-328
        // The exact URL comes from the Convex deployment
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
        const httpUrl = convexUrl.replace(".cloud", ".site");

        const response = await fetch(`${httpUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            model: selectedModel,
            sessionId: chatSessionId,
            workoutSessionId: sessionId,
            workoutContext: workoutContextRef.current,
            images: images ?? [],
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const token =
                  parsed.choices?.[0]?.delta?.content ?? "";
                accumulated += token;
                setStreamingContent(accumulated);
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }

        // Save assistant response
        if (accumulated) {
          await sendChatMessage({
            sessionId: chatSessionId,
            role: "assistant",
            content: accumulated,
            model: selectedModel,
          });
        }
      } catch (err) {
        console.error("Chat stream error:", err);
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [chatSessionId, isStreaming, messages, selectedModel, sessionId, sendChatMessage]
  );

  return {
    messages: messages ?? [],
    isStreaming,
    streamingContent,
    selectedModel,
    setSelectedModel,
    sendMessage,
    pushContext,
  };
}
```

**Important — tool execution handling:** The existing `handleSend` in `page.tsx` (lines 204-328) includes logic for parsing tool calls from the SSE stream and handling tool results (the AI can call `completeSet`, `startSet`, `logExercise`, etc. via tool use). The code above shows only content token parsing for brevity. During implementation, you MUST port the full tool call parsing from the existing `handleSend`:

1. Read `page.tsx` lines 204-328 to understand the tool call flow
2. SSE events may contain `tool_calls` in `delta` objects — these need to be accumulated and dispatched
3. After a tool executes server-side, the AI sends follow-up content — parse and display this
4. After any tool that mutates workout state (completeSet, startSet, logExercise), refresh `workoutContextRef.current` so the AI's next turn has updated state
5. Port the 50ms flush batching for UI updates

The code above is the structural skeleton. The SSE parsing loop must match the existing implementation precisely, including tool result handling.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWorkoutChat.ts
git commit -m "feat(workout): extract useWorkoutChat hook from monolithic page"
```

---

### Task 10: Create ChatTab Component

Full-screen chat tab that pushes workout context on mount/focus.

**Files:**
- Create: `src/components/workout/ChatTab.tsx`
- Reference: `src/components/WorkoutChatOverlay.tsx` (for message UI patterns)

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/ChatTab.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useWorkoutChat } from "@/hooks/useWorkoutChat";
import { Id } from "../../../convex/_generated/dataModel";

interface ChatTabProps {
  chatSessionId: Id<"chatSessions"> | null;
  isVisible: boolean;
}

export default function ChatTab({ chatSessionId, isVisible }: ChatTabProps) {
  const { sessionId, session, exercises } = useWorkout();
  const {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    pushContext,
  } = useWorkoutChat({ sessionId, chatSessionId });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Push workout context whenever this tab becomes visible
  useEffect(() => {
    if (!isVisible || !session || !exercises) return;

    const context = JSON.stringify({
      type: session.type,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.length,
        lastSet: ex.sets[ex.sets.length - 1],
      })),
      activeSet: session.activeSet,
      isResting: session.activeRestStartedAt != null,
    });

    pushContext(context);
  }, [isVisible, session, exercises, pushContext]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-900 text-zinc-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && streamingContent && (
          <div className="mb-3 text-left">
            <div className="inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-zinc-900 text-zinc-100">
              {streamingContent}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3 pb-safe">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 bg-zinc-900 text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50 active:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note: This is a simplified chat UI. The existing `WorkoutChatOverlay.tsx` has image attachments, model selection, quick chips, and markdown rendering. During implementation, decide which of those features to port. At minimum, start with text-only chat and iterate. Image support and model selection can be added as follow-up tasks.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/ChatTab.tsx
git commit -m "feat(workout): add ChatTab with context push on visibility"
```

---

## Chunk 4: Tab Bar and Page Shell

### Task 11: Create TabBar Component

Swipeable tab switcher between Track and Chat.

**Files:**
- Create: `src/components/workout/TabBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/workout/TabBar.tsx
"use client";

import { useRef, useCallback } from "react";

interface TabBarProps {
  activeTab: "track" | "chat";
  onTabChange: (tab: "track" | "chat") => void;
}

/**
 * Tab bar with swipe gesture support.
 * Swipe left/right anywhere on the page triggers tab switch.
 * The gesture area is a full-width invisible overlay above the tab bar.
 * Swipe-to-confirm on ExerciseHero uses touchAction: "pan-y" to prevent
 * conflicts (horizontal swipes on that element are captured by SwipeConfirm).
 */
export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const startXRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startXRef.current;
      const threshold = 50; // minimum swipe distance in px
      if (Math.abs(dx) < threshold) return;

      if (dx < 0 && activeTab === "track") {
        onTabChange("chat");
      } else if (dx > 0 && activeTab === "chat") {
        onTabChange("track");
      }
    },
    [activeTab, onTabChange]
  );

  return (
    <>
      {/* Full-screen swipe detection overlay.
          Covers entire screen above the tab bar. pointer-events: none on children
          is NOT used here — the overlay intercepts horizontal swipes while
          vertical scroll passes through via CSS touch-action: pan-y. */}
      <div
        className="fixed inset-0 bottom-12 z-[9]"
        style={{ touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-10">
        <div className="flex justify-center gap-12 py-3 pb-safe">
          <button
            onClick={() => onTabChange("track")}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "track" ? "text-white" : "text-zinc-600"
            }`}
          >
            Track
          </button>
          <button
            onClick={() => onTabChange("chat")}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "chat" ? "text-white" : "text-zinc-600"
            }`}
          >
            Chat
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/TabBar.tsx
git commit -m "feat(workout): add TabBar component"
```

---

### Task 12: Rewrite Workout Page

Replace the 617-line monolith with a thin shell that manages session lifecycle, tab state, and renders the context provider + tabs.

**Files:**
- Modify: `src/app/workout/page.tsx` (complete rewrite)
- Reference: existing `src/app/workout/page.tsx:71-617` for session lifecycle logic

- [ ] **Step 1: Read the existing page**

Read `src/app/workout/page.tsx` in full. Note:
- Lines 71-90: Session lifecycle (queries, mutations)
- Lines 108-200: Session creation/management effects
- Lines 405-435: Exit/finish workout handlers
- Lines 440-617: JSX render

These are the parts to preserve. Everything else (chat streaming, timer intervals, metric computation, history sheet) moves to the new components/hooks.

- [ ] **Step 2: Rewrite the page**

```tsx
// src/app/workout/page.tsx
"use client";

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import TabBar from "@/components/workout/TabBar";

const TrackTab = lazy(() => import("@/components/workout/TrackTab"));
const ChatTab = lazy(() => import("@/components/workout/ChatTab"));

export default function WorkoutPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"track" | "chat">("track");
  const [chatSessionId, setChatSessionId] = useState<Id<"chatSessions"> | null>(null);

  // Session queries
  const activeSession = useQuery(api.workoutSessions.getActive);
  const sessionId = activeSession?._id ?? null;

  // Session mutations
  const createActive = useMutation(api.workoutSessions.createActive);
  const finishActive = useMutation(api.workoutSessions.finishActive);
  const removeSession = useMutation(api.workoutSessions.remove);
  const createChatSession = useMutation(api.chatSessions.create);

  // Create chat session for this workout (once)
  useEffect(() => {
    if (!sessionId || chatSessionId) return;

    // Check sessionStorage for existing chat session
    const stored = sessionStorage.getItem(`workout-chat-${sessionId}`);
    if (stored) {
      setChatSessionId(stored as Id<"chatSessions">);
      return;
    }

    createChatSession({ title: "Workout Chat" }).then((id) => {
      sessionStorage.setItem(`workout-chat-${sessionId}`, id);
      setChatSessionId(id);
    });
  }, [sessionId, chatSessionId, createChatSession]);

  const handleFinish = useCallback(async () => {
    if (!sessionId) return;
    await finishActive({ sessionId });
    router.push("/dashboard");
  }, [sessionId, finishActive, router]);

  const handleExit = useCallback(async () => {
    if (!sessionId) return;
    await removeSession({ id: sessionId });
    router.push("/dashboard");
  }, [sessionId, removeSession, router]);

  // No active session — show start screen
  if (activeSession === null) {
    return <StartWorkoutScreen onCreate={createActive} />;
  }

  // Loading
  if (activeSession === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <WorkoutProvider sessionId={sessionId}>
      <div className="min-h-screen bg-black text-white">
        {/* Finish button */}
        <div className="fixed top-4 right-4 z-20">
          <button
            onClick={handleFinish}
            className="text-sm text-zinc-500 bg-zinc-900 rounded-lg px-3 py-1.5 active:bg-zinc-800"
          >
            Finish
          </button>
        </div>

        {/* Tab content — both tabs stay mounted to preserve state.
            Hidden tab uses visibility:hidden + position:absolute to avoid
            layout cost while keeping React state alive (chat streaming,
            scroll position, input text). */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              Loading...
            </div>
          }
        >
          <div style={{ display: activeTab === "track" ? "block" : "none" }}>
            <TrackTab />
          </div>
          <div
            style={{
              visibility: activeTab === "chat" ? "visible" : "hidden",
              position: activeTab === "chat" ? "relative" : "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            <ChatTab
              chatSessionId={chatSessionId}
              isVisible={activeTab === "chat"}
            />
          </div>
        </Suspense>

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </WorkoutProvider>
  );
}

// --- Start Workout Screen ---

function StartWorkoutScreen({
  onCreate,
}: {
  onCreate: (args: { type: string }) => Promise<unknown>;
}) {
  const router = useRouter();
  const workoutTypes = useQuery(api.workoutTypes.list);

  const handleStart = useCallback(
    async (type: string) => {
      await onCreate({ type });
    },
    [onCreate]
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold mb-8">Start Workout</h1>
      <div className="w-full max-w-sm space-y-3">
        {(workoutTypes ?? []).map((wt) => (
          <button
            key={wt._id}
            onClick={() => handleStart(wt.name)}
            className="w-full bg-zinc-900 rounded-xl py-4 text-center text-lg font-medium active:bg-zinc-800"
          >
            {wt.name}
          </button>
        ))}
      </div>
      <button
        onClick={() => router.push("/dashboard")}
        className="mt-8 text-sm text-zinc-600"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
```

**Important implementation notes:**
- The `createActive` mutation signature may differ from what's shown. Check `convex/workoutSessions.ts:181-195` for exact args.
- The `workoutTypes.list` query may not exist yet — check `convex/workoutTypes.ts` and adapt.
- The `StartWorkoutScreen` is a simplified version. Port any existing start-workout logic from the current page.
- The exit workflow (delete session) should probably have a confirmation. Add if the current implementation has one.

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 4: Verify dev server starts**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next dev --turbopack`

Open `http://localhost:3000/workout` and verify:
- The page loads without errors
- If no active session, the start workout screen appears
- Tabs switch between Track and Chat

- [ ] **Step 5: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "feat(workout): rewrite page as thin shell with tab-based split"
```

---

## Chunk 5: Backend Additions and Cleanup

### Task 13: Add Server-Side Metrics Query

Move volume and set count computation to the server.

**Files:**
- Create: `convex/workoutMetrics.ts`

- [ ] **Step 1: Create the metrics query**

```ts
// convex/workoutMetrics.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSessionMetrics = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, { sessionId }) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    let totalSets = 0;
    let totalVolume = 0;

    for (const ex of exercises) {
      for (const set of ex.sets) {
        totalSets++;
        totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
      }
    }

    return {
      totalSets,
      totalVolume,
      exerciseCount: exercises.length,
    };
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx convex dev --once`

If `convex dev --once` isn't available, run `npx convex dev` and check for errors, then Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add convex/workoutMetrics.ts
git commit -m "feat(workout): add server-side session metrics query"
```

---

### Task 14: Wire Metrics Into TrackTab Header

Use the server-side metrics in the Track tab.

**Files:**
- Modify: `src/components/workout/TrackTab.tsx`

- [ ] **Step 1: Read current TrackTab**

Read `src/components/workout/TrackTab.tsx`.

- [ ] **Step 2: Add metrics query to TrackTab header**

Add to the TrackTab component:

```tsx
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatNum } from "@/lib/utils";
```

Inside the component, after getting `sessionId` from `useWorkout()`:

```tsx
const metrics = useQuery(
  api.workoutMetrics.getSessionMetrics,
  sessionId ? { sessionId } : "skip"
);
```

Update the header section to show metrics:

```tsx
{/* Header */}
<div className="flex justify-between items-center px-4 pt-4 pb-2">
  <span className="text-sm text-zinc-500">
    {session?.type ?? "Workout"}
  </span>
  <span className="text-sm text-zinc-500">
    {metrics ? `${metrics.totalSets} sets · ${formatNum(metrics.totalVolume)} lbs` : ""}
  </span>
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/TrackTab.tsx
git commit -m "feat(workout): wire server-side metrics into TrackTab header"
```

---

### Task 15: Add suggestNextExercise Backend Function

Provides AI-driven exercise suggestions based on workout type history. Called by TrackTab when no active exercise is set.

**Files:**
- Create: `convex/exerciseSuggestions.ts`
- Modify: `src/components/workout/TrackTab.tsx` (wire suggestion)

- [ ] **Step 1: Create the suggestion query**

```ts
// convex/exerciseSuggestions.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Suggests the next exercise based on what the user typically does
 * for this workout type, in what order, excluding exercises already
 * done in the current session.
 */
export const suggestNext = query({
  args: {
    sessionId: v.id("workoutSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    // Get exercises already done in this session
    const currentExercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const doneNames = new Set(
      currentExercises.map((e) => e.name.toLowerCase())
    );

    // Get recent sessions of the same workout type
    const recentSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_type", (q) => q.eq("type", session.type))
      .order("desc")
      .take(10);

    // Count exercise frequency and track typical order
    const exerciseOrder: Map<string, { count: number; avgPosition: number }> =
      new Map();

    for (const pastSession of recentSessions) {
      if (pastSession._id === sessionId) continue;

      const pastExercises = await ctx.db
        .query("exercises")
        .withIndex("by_session", (q) =>
          q.eq("sessionId", pastSession._id)
        )
        .collect();

      pastExercises.forEach((ex, index) => {
        const name = ex.name.toLowerCase();
        const existing = exerciseOrder.get(name) ?? {
          count: 0,
          avgPosition: 0,
        };
        existing.avgPosition =
          (existing.avgPosition * existing.count + index) /
          (existing.count + 1);
        existing.count++;
        exerciseOrder.set(name, existing);
      });
    }

    // Find the next exercise the user hasn't done yet, ordered by
    // typical position (what they'd normally do next)
    const currentPosition = currentExercises.length;
    const candidates = [...exerciseOrder.entries()]
      .filter(([name]) => !doneNames.has(name))
      .sort(
        (a, b) =>
          Math.abs(a[1].avgPosition - currentPosition) -
          Math.abs(b[1].avgPosition - currentPosition)
      );

    if (candidates.length === 0) return null;

    // Return the original casing from the most recent occurrence
    const suggestedName = candidates[0][0];
    for (const pastSession of recentSessions) {
      const pastExercises = await ctx.db
        .query("exercises")
        .withIndex("by_session", (q) =>
          q.eq("sessionId", pastSession._id)
        )
        .collect();
      const match = pastExercises.find(
        (e) => e.name.toLowerCase() === suggestedName
      );
      if (match) return match.name;
    }

    return candidates[0][0];
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx convex dev --once`

- [ ] **Step 3: Wire suggestion into TrackTab**

Read `src/components/workout/TrackTab.tsx`. Add the suggestion query:

```tsx
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
```

Replace the `useState<string | null>(null)` for suggestion with a Convex query:

```tsx
const suggestion = useQuery(
  api.exerciseSuggestions.suggestNext,
  sessionId && !activeSet ? { sessionId } : "skip"
);
```

Remove the `setSuggestion` state and the `handleDismissSuggestion` callback. Update the `ExerciseSuggestion` component to use a local dismissed state:

```tsx
const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);

// In the JSX, show suggestion only if not dismissed:
const activeSuggestion = suggestion && suggestion !== dismissedSuggestion ? suggestion : null;
```

Update `handleDismissSuggestion`:
```tsx
const handleDismissSuggestion = useCallback(() => {
  if (suggestion) setDismissedSuggestion(suggestion);
}, [suggestion]);
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add convex/exerciseSuggestions.ts src/components/workout/TrackTab.tsx
git commit -m "feat(workout): add AI exercise suggestion based on workout type history"
```

---

### Task 16: Remove Old Workout Components

Clean up the files that have been replaced.

**Files:**
- Remove: `src/components/WorkoutFocusPanel.tsx`
- Remove: `src/components/WorkoutChatOverlay.tsx`
- Remove: `src/components/ActiveExerciseFeed.tsx`

- [ ] **Step 1: Check for other imports of these files**

Search the codebase for any remaining imports of `WorkoutFocusPanel`, `WorkoutChatOverlay`, or `ActiveExerciseFeed`. If any file other than the old `page.tsx` imports them, update those imports first.

Run:
```bash
cd /Users/noahkenny/Documents/Projects/zenith-fitness
grep -r "WorkoutFocusPanel\|WorkoutChatOverlay\|ActiveExerciseFeed" src/ --include="*.tsx" --include="*.ts" -l
```

- [ ] **Step 2: Remove the files**

Only remove if no other files import them (besides the old page.tsx which has been rewritten).

```bash
rm src/components/WorkoutFocusPanel.tsx
rm src/components/WorkoutChatOverlay.tsx
rm src/components/ActiveExerciseFeed.tsx
```

- [ ] **Step 3: Verify the app still compiles**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next lint`

- [ ] **Step 4: Commit**

```bash
git add -u src/components/WorkoutFocusPanel.tsx src/components/WorkoutChatOverlay.tsx src/components/ActiveExerciseFeed.tsx
git commit -m "chore(workout): remove old monolithic workout components"
```

---

### Task 17: End-to-End Verification

Verify the complete redesigned workout flow works.

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/noahkenny/Documents/Projects/zenith-fitness && npx next dev --turbopack`

- [ ] **Step 2: Test the full flow**

Open `http://localhost:3000/workout` on a phone or phone-sized browser window. Verify:

1. **Start screen** — workout types appear, tapping one creates an active session
2. **Track tab** — timer starts, exercise suggestion or hero appears
3. **Set logging** — steppers adjust weight/reps, swipe confirms the set, rest timer starts
4. **Tab switching** — tapping Chat/Track switches views
5. **Chat tab** — messages send and stream, AI has workout context
6. **Finish** — tapping Finish completes the session and navigates to dashboard

- [ ] **Step 3: Fix any issues found**

Address any compilation errors, runtime errors, or broken interactions.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(workout): complete workout feature redesign - tab-based split with phone-first UI"
```
