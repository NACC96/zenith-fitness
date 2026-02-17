import type { ParseIssue, SessionInsight } from "./ingestion-contract";
import type { ParsedWorkoutSession } from "./model";

const LOW_CONFIDENCE_THRESHOLD = 0.85;
const SUPPRESSION_WARNING_CODES = new Set<string>([
  "AMBIGUOUS_VALUE",
  "MISSING_FIELD",
  "INVALID_VALUE",
  "INTERNAL_ERROR",
]);

const roundToHundredths = (value: number): number => Math.round(value * 100) / 100;

const toSigned = (value: number): string => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

export interface SessionInsightParseQuality {
  overallConfidence: number;
  warnings: ParseIssue[];
  errors: ParseIssue[];
}

export interface BuildSessionInsightInput {
  session: ParsedWorkoutSession;
  previousSession: ParsedWorkoutSession | null;
  parseQuality?: SessionInsightParseQuality;
}

const defaultParseQuality: SessionInsightParseQuality = {
  overallConfidence: 1,
  warnings: [],
  errors: [],
};

export const shouldSuppressInsight = (
  parseQuality: SessionInsightParseQuality
): boolean => {
  if (parseQuality.errors.length > 0) {
    return true;
  }

  if (parseQuality.overallConfidence < LOW_CONFIDENCE_THRESHOLD) {
    return true;
  }

  return parseQuality.warnings.some((warning) =>
    SUPPRESSION_WARNING_CODES.has(warning.code)
  );
};

const buildAnomalies = (session: ParsedWorkoutSession): string[] => {
  const anomalies: string[] = [];
  const delta = session.metrics.previousSessionTotalLbsDelta ?? null;

  if (delta != null && delta <= -150) {
    anomalies.push("Total session volume dropped sharply versus the previous session.");
  }

  const largestExerciseDrop = session.metrics.perExerciseProgression
    .filter((entry) => entry.volumeDeltaLbs < 0)
    .sort((left, right) => left.volumeDeltaLbs - right.volumeDeltaLbs)[0];

  if (largestExerciseDrop) {
    anomalies.push(
      `Largest exercise drop: ${largestExerciseDrop.exerciseKey} (${toSigned(
        largestExerciseDrop.volumeDeltaLbs
      )} lbs).`
    );
  }

  return anomalies;
};

const buildRecommendations = (session: ParsedWorkoutSession): string[] => {
  const recommendations: string[] = [];
  const delta = session.metrics.previousSessionTotalLbsDelta ?? null;

  if (delta == null) {
    recommendations.push("Use this session as a baseline and repeat to establish trend.");
    return recommendations;
  }

  if (delta > 0) {
    recommendations.push("Progress is positive; keep the current load progression conservative.");
  } else if (delta < 0) {
    recommendations.push("Volume regressed; reduce jumps and focus on consistency next session.");
  } else {
    recommendations.push("Volume is flat; add a small rep or load increase next session.");
  }

  const bestExerciseGain = session.metrics.perExerciseProgression
    .filter((entry) => entry.volumeDeltaLbs > 0)
    .sort((left, right) => right.volumeDeltaLbs - left.volumeDeltaLbs)[0];
  if (bestExerciseGain) {
    recommendations.push(
      `Strongest mover: ${bestExerciseGain.exerciseKey} (${toSigned(
        bestExerciseGain.volumeDeltaLbs
      )} lbs).`
    );
  }

  return recommendations;
};

export const buildSessionInsight = ({
  session,
  previousSession,
  parseQuality = defaultParseQuality,
}: BuildSessionInsightInput): SessionInsight => {
  const normalizedConfidence = Math.max(
    0,
    Math.min(1, roundToHundredths(parseQuality.overallConfidence))
  );

  if (shouldSuppressInsight(parseQuality)) {
    return {
      sessionId: session.session.id,
      mode: "review",
      confidence: normalizedConfidence,
      headline: "Review parsed workout before coaching guidance.",
      summary:
        "Parser confidence is low or ambiguous. Apply corrections first, then refresh insights.",
      recommendations: [],
      anomalies: [],
    };
  }

  const delta = session.metrics.previousSessionTotalLbsDelta ?? null;
  const headline =
    delta == null
      ? "Baseline session captured."
      : delta > 0
        ? "Session progression is trending up."
        : delta < 0
          ? "Session progression dipped."
          : "Session progression is flat.";

  const summary = previousSession
    ? `Total lifted ${toSigned(delta ?? 0)} lbs vs previous same-type session (${roundToHundredths(
        previousSession.metrics.totalLbsLifted
      )} lbs -> ${roundToHundredths(session.metrics.totalLbsLifted)} lbs).`
    : `No prior same-type session available. Current total: ${roundToHundredths(
        session.metrics.totalLbsLifted
      )} lbs.`;

  return {
    sessionId: session.session.id,
    mode: "actionable",
    confidence: normalizedConfidence,
    headline,
    summary,
    recommendations: buildRecommendations(session),
    anomalies: buildAnomalies(session),
  };
};
