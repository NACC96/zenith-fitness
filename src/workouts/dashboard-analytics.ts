import type { WorkoutIngestionRepository } from "./ingestion-repository";
import {
  BUILTIN_WORKOUT_TYPE_SLUGS,
  type BuiltInWorkoutTypeSlug,
  type ParsedWorkoutSession,
} from "./model";

const BUILTIN_WORKOUT_TYPE_LABELS: Record<BuiltInWorkoutTypeSlug, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
};

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const roundToHundredths = (value: number): number => Math.round(value * 100) / 100;

const optionalTrimmed = (value: string | null | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toTimestamp = (value: string): number | null => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const toDateBoundary = (date: string, boundary: "start" | "end"): string => {
  return boundary === "start"
    ? `${date}T00:00:00.000Z`
    : `${date}T23:59:59.999Z`;
};

const titleCaseWords = (value: string): string => {
  return value
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }

      return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
};

const toHumanWorkoutTypeLabel = (workoutTypeId: string): string => {
  const cleaned = workoutTypeId
    .replace(/^workout[-_]?type[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!cleaned) {
    return workoutTypeId;
  }

  return titleCaseWords(cleaned);
};

const resolveBuiltInWorkoutTypeSlug = (
  workoutTypeId: string
): BuiltInWorkoutTypeSlug | null => {
  const normalized = workoutTypeId.trim().toLowerCase();
  for (const slug of BUILTIN_WORKOUT_TYPE_SLUGS) {
    if (
      normalized === slug ||
      normalized.endsWith(`-${slug}`) ||
      new RegExp(`(^|[^a-z0-9])${slug}([^a-z0-9]|$)`, "i").test(normalized)
    ) {
      return slug;
    }
  }

  return null;
};

const resolveWorkoutTypeLabel = (workoutTypeId: string): string => {
  const builtInSlug = resolveBuiltInWorkoutTypeSlug(workoutTypeId);
  if (builtInSlug) {
    return BUILTIN_WORKOUT_TYPE_LABELS[builtInSlug];
  }

  return toHumanWorkoutTypeLabel(workoutTypeId);
};

const compareSessionsByOccurredAt = (
  left: ParsedWorkoutSession,
  right: ParsedWorkoutSession
): number => {
  const leftTimestamp = toTimestamp(left.session.occurredAt) ?? 0;
  const rightTimestamp = toTimestamp(right.session.occurredAt) ?? 0;
  if (leftTimestamp === rightTimestamp) {
    return left.session.id.localeCompare(right.session.id);
  }
  return leftTimestamp - rightTimestamp;
};

interface ExerciseTotals {
  totalVolumeLbs: number;
  totalReps: number;
}

interface FilteredSessionContext {
  previousSessionById: Map<string, ParsedWorkoutSession | null>;
  previousSessionTotalLbsDeltaById: Map<string, number | null>;
}

const buildFilteredSessionContext = (
  sessions: ParsedWorkoutSession[]
): FilteredSessionContext => {
  const previousSessionById = new Map<string, ParsedWorkoutSession | null>();
  const previousSessionTotalLbsDeltaById = new Map<string, number | null>();
  const latestByWorkoutTypeId = new Map<string, ParsedWorkoutSession>();

  for (const session of sessions) {
    const previousSession =
      latestByWorkoutTypeId.get(session.session.workoutTypeId) ?? null;
    previousSessionById.set(session.session.id, previousSession);
    previousSessionTotalLbsDeltaById.set(
      session.session.id,
      previousSession
        ? roundToHundredths(
            session.metrics.totalLbsLifted - previousSession.metrics.totalLbsLifted
          )
        : null
    );
    latestByWorkoutTypeId.set(session.session.workoutTypeId, session);
  }

  return {
    previousSessionById,
    previousSessionTotalLbsDeltaById,
  };
};

const totalsByExerciseKey = (
  session: ParsedWorkoutSession | null | undefined
): Map<string, ExerciseTotals> => {
  const totals = new Map<string, ExerciseTotals>();
  if (!session) {
    return totals;
  }

  for (const exercise of session.exercisePerformances) {
    totals.set(exercise.exerciseKey, {
      totalVolumeLbs: exercise.totalVolumeLbs,
      totalReps: exercise.totalReps,
    });
  }

  return totals;
};

export interface DashboardFilterInput {
  workoutType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DashboardFilterState {
  workoutType?: string;
  startDate?: string;
  endDate?: string;
  startOccurredAt?: string;
  endOccurredAt?: string;
}

export interface DashboardWorkoutTypeOption {
  value: string;
  label: string;
  isBuiltIn: boolean;
}

export interface DashboardKeyStats {
  totalSessions: number;
  totalLbsLifted: number;
  totalSets: number;
  totalReps: number;
}

export interface DashboardTrendStats {
  windowStartOccurredAt: string | null;
  windowEndOccurredAt: string | null;
  totalLbsDelta: number | null;
  totalLbsDeltaPercent: number | null;
  averageLbsPerSession: number;
  averageSetsPerSession: number;
  averageRepsPerSession: number;
}

export interface DashboardLatestSessionSummary {
  sessionId: string;
  occurredAt: string;
  workoutTypeId: string;
  workoutTypeLabel: string;
  totalLbsLifted: number;
  totalSets: number;
  totalReps: number;
}

export interface DashboardSessionComparison {
  previousSessionTotalLbsDelta: number | null;
  direction: "up" | "down" | "flat" | "none";
  description: string;
}

export interface DashboardSessionHistoryRow {
  sessionId: string;
  occurredAt: string;
  workoutTypeId: string;
  workoutTypeLabel: string;
  totalLbsLifted: number;
  totalSets: number;
  totalReps: number;
  previousSessionTotalLbsDelta: number | null;
}

export interface DashboardExerciseProgressionRow {
  exerciseKey: string;
  exerciseName: string;
  totalVolumeLbs: number;
  totalReps: number;
  volumeDeltaLbs: number;
  repDelta: number;
}

export interface DashboardAnalyticsView {
  filter: DashboardFilterState;
  workoutTypeOptions: DashboardWorkoutTypeOption[];
  isEmpty: boolean;
  emptyStateMessage?: string;
  keyStats: DashboardKeyStats;
  trendStats: DashboardTrendStats;
  latestSession: DashboardLatestSessionSummary | null;
  sessionComparison: DashboardSessionComparison | null;
  sessionHistory: DashboardSessionHistoryRow[];
  progression: DashboardExerciseProgressionRow[];
}

export interface BuildDashboardAnalyticsViewInput {
  repository: WorkoutIngestionRepository;
  filter?: DashboardFilterInput;
}

const buildWorkoutTypeOptions = (
  sessions: ParsedWorkoutSession[]
): DashboardWorkoutTypeOption[] => {
  const customWorkoutTypeIds = new Set<string>();
  for (const session of sessions) {
    const workoutTypeId = session.session.workoutTypeId;
    if (!resolveBuiltInWorkoutTypeSlug(workoutTypeId)) {
      customWorkoutTypeIds.add(workoutTypeId);
    }
  }

  const builtInOptions = BUILTIN_WORKOUT_TYPE_SLUGS.map((slug) => ({
    value: slug,
    label: BUILTIN_WORKOUT_TYPE_LABELS[slug],
    isBuiltIn: true,
  }));

  const customOptions = Array.from(customWorkoutTypeIds)
    .sort((left, right) => left.localeCompare(right))
    .map((workoutTypeId) => ({
      value: workoutTypeId,
      label: toHumanWorkoutTypeLabel(workoutTypeId),
      isBuiltIn: false,
    }));

  return [...builtInOptions, ...customOptions];
};

const matchesWorkoutTypeFilter = (
  session: ParsedWorkoutSession,
  workoutType: string | undefined
): boolean => {
  if (!workoutType) {
    return true;
  }

  if (
    BUILTIN_WORKOUT_TYPE_SLUGS.includes(
      workoutType as (typeof BUILTIN_WORKOUT_TYPE_SLUGS)[number]
    )
  ) {
    return resolveBuiltInWorkoutTypeSlug(session.session.workoutTypeId) === workoutType;
  }

  return session.session.workoutTypeId === workoutType;
};

const buildEmptyStateMessage = (filter: DashboardFilterState): string => {
  if (filter.workoutType || filter.startDate || filter.endDate) {
    return "No sessions match the selected filters.";
  }

  return "No workout sessions yet. Submit a workout log to populate analytics.";
};

const buildSessionComparison = (
  inRangePreviousSessionTotalLbsDelta: number | null
): DashboardSessionComparison => {
  if (inRangePreviousSessionTotalLbsDelta == null) {
    return {
      previousSessionTotalLbsDelta: null,
      direction: "none",
      description: "No previous session is available for this workout type yet.",
    };
  }

  const direction =
    inRangePreviousSessionTotalLbsDelta > 0
      ? "up"
      : inRangePreviousSessionTotalLbsDelta < 0
        ? "down"
        : "flat";

  return {
    previousSessionTotalLbsDelta: inRangePreviousSessionTotalLbsDelta,
    direction,
    description:
      direction === "up"
        ? "Total lifted is up versus the previous same-type session."
        : direction === "down"
          ? "Total lifted is down versus the previous same-type session."
          : "Total lifted is unchanged versus the previous same-type session.",
  };
};

const normalizeDateInput = (value: string | null | undefined): string | undefined => {
  const trimmed = optionalTrimmed(value);
  if (!trimmed || !DATE_INPUT_PATTERN.test(trimmed)) {
    return undefined;
  }

  if (toTimestamp(`${trimmed}T00:00:00.000Z`) == null) {
    return undefined;
  }

  return trimmed;
};

export const normalizeDashboardFilter = (
  input: DashboardFilterInput = {}
): DashboardFilterState => {
  const workoutType = optionalTrimmed(input.workoutType);
  const normalizedWorkoutType =
    workoutType && workoutType.toLowerCase() !== "all" ? workoutType : undefined;
  const startDate = normalizeDateInput(input.startDate);
  const endDate = normalizeDateInput(input.endDate);

  return {
    workoutType: normalizedWorkoutType,
    startDate,
    endDate,
    startOccurredAt: startDate ? toDateBoundary(startDate, "start") : undefined,
    endOccurredAt: endDate ? toDateBoundary(endDate, "end") : undefined,
  };
};

const emptyTrendStats: DashboardTrendStats = {
  windowStartOccurredAt: null,
  windowEndOccurredAt: null,
  totalLbsDelta: null,
  totalLbsDeltaPercent: null,
  averageLbsPerSession: 0,
  averageSetsPerSession: 0,
  averageRepsPerSession: 0,
};

export const buildDashboardAnalyticsView = async ({
  repository,
  filter: rawFilter = {},
}: BuildDashboardAnalyticsViewInput): Promise<DashboardAnalyticsView> => {
  const filter = normalizeDashboardFilter(rawFilter);

  const [allSessions, dateWindowSessions] = await Promise.all([
    repository.listParsedSessions(),
    repository.listParsedSessions({
      startOccurredAt: filter.startOccurredAt,
      endOccurredAt: filter.endOccurredAt,
    }),
  ]);

  const workoutTypeOptions = buildWorkoutTypeOptions(allSessions);
  const filteredSessions = dateWindowSessions
    .filter((session) => matchesWorkoutTypeFilter(session, filter.workoutType))
    .sort(compareSessionsByOccurredAt);

  if (filteredSessions.length === 0) {
    return {
      filter,
      workoutTypeOptions,
      isEmpty: true,
      emptyStateMessage: buildEmptyStateMessage(filter),
      keyStats: {
        totalSessions: 0,
        totalLbsLifted: 0,
        totalSets: 0,
        totalReps: 0,
      },
      trendStats: emptyTrendStats,
      latestSession: null,
      sessionComparison: null,
      sessionHistory: [],
      progression: [],
    };
  }

  const latestSession = filteredSessions[filteredSessions.length - 1];
  const oldestSession = filteredSessions[0];
  const totalSessions = filteredSessions.length;
  const totalLbsLifted = roundToHundredths(
    filteredSessions.reduce((sum, session) => sum + session.metrics.totalLbsLifted, 0)
  );
  const totalSets = filteredSessions.reduce((sum, session) => sum + session.metrics.totalSets, 0);
  const totalReps = filteredSessions.reduce((sum, session) => sum + session.metrics.totalReps, 0);

  const totalLbsDelta =
    totalSessions > 1
      ? roundToHundredths(
          latestSession.metrics.totalLbsLifted - oldestSession.metrics.totalLbsLifted
        )
      : null;
  const totalLbsDeltaPercent =
    totalLbsDelta != null && oldestSession.metrics.totalLbsLifted > 0
      ? roundToHundredths(
          (totalLbsDelta / oldestSession.metrics.totalLbsLifted) * 100
        )
      : null;

  const filteredSessionContext = buildFilteredSessionContext(filteredSessions);
  const latestInRangePreviousSession =
    filteredSessionContext.previousSessionById.get(latestSession.session.id) ?? null;
  const latestInRangePreviousSessionExerciseTotals = totalsByExerciseKey(
    latestInRangePreviousSession
  );

  const progression = [...latestSession.exercisePerformances]
    .sort((left, right) => left.exerciseOrder - right.exerciseOrder)
    .map((exercise) => {
      const previousTotals = latestInRangePreviousSessionExerciseTotals.get(
        exercise.exerciseKey
      );
      return {
        exerciseKey: exercise.exerciseKey,
        exerciseName: exercise.exerciseName,
        totalVolumeLbs: exercise.totalVolumeLbs,
        totalReps: exercise.totalReps,
        volumeDeltaLbs: previousTotals
          ? roundToHundredths(exercise.totalVolumeLbs - previousTotals.totalVolumeLbs)
          : 0,
        repDelta: previousTotals ? exercise.totalReps - previousTotals.totalReps : 0,
      };
    });

  const sessionHistory = [...filteredSessions]
    .sort(compareSessionsByOccurredAt)
    .reverse()
    .map((session) => ({
      sessionId: session.session.id,
      occurredAt: session.session.occurredAt,
      workoutTypeId: session.session.workoutTypeId,
      workoutTypeLabel: resolveWorkoutTypeLabel(session.session.workoutTypeId),
      totalLbsLifted: session.metrics.totalLbsLifted,
      totalSets: session.metrics.totalSets,
      totalReps: session.metrics.totalReps,
      previousSessionTotalLbsDelta:
        filteredSessionContext.previousSessionTotalLbsDeltaById.get(session.session.id) ??
        null,
    }));

  return {
    filter,
    workoutTypeOptions,
    isEmpty: false,
    keyStats: {
      totalSessions,
      totalLbsLifted,
      totalSets,
      totalReps,
    },
    trendStats: {
      windowStartOccurredAt: oldestSession.session.occurredAt,
      windowEndOccurredAt: latestSession.session.occurredAt,
      totalLbsDelta,
      totalLbsDeltaPercent,
      averageLbsPerSession: roundToHundredths(totalLbsLifted / totalSessions),
      averageSetsPerSession: roundToHundredths(totalSets / totalSessions),
      averageRepsPerSession: roundToHundredths(totalReps / totalSessions),
    },
    latestSession: {
      sessionId: latestSession.session.id,
      occurredAt: latestSession.session.occurredAt,
      workoutTypeId: latestSession.session.workoutTypeId,
      workoutTypeLabel: resolveWorkoutTypeLabel(latestSession.session.workoutTypeId),
      totalLbsLifted: latestSession.metrics.totalLbsLifted,
      totalSets: latestSession.metrics.totalSets,
      totalReps: latestSession.metrics.totalReps,
    },
    sessionComparison: buildSessionComparison(
      filteredSessionContext.previousSessionTotalLbsDeltaById.get(
        latestSession.session.id
      ) ?? null
    ),
    sessionHistory,
    progression,
  };
};
