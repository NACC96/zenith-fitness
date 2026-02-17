"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  DashboardLatestSessionSummary,
  DashboardSessionComparison,
} from "../../../workouts/dashboard-analytics";
import styles from "./dashboard-session-summary.module.css";

interface DashboardSessionSummaryProps {
  latestSession: DashboardLatestSessionSummary | null;
  sessionComparison: DashboardSessionComparison | null;
}

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatSignedDelta = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US")} lbs`;
};

export function DashboardSessionSummary({
  latestSession,
  sessionComparison,
}: DashboardSessionSummaryProps) {
  if (!latestSession) {
    return (
      <div className={styles.panel}>
        <p className={styles.emptyLabel}>No sessions recorded yet.</p>
      </div>
    );
  }

  const direction = sessionComparison?.direction ?? "none";
  const delta = sessionComparison?.previousSessionTotalLbsDelta ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Latest Session</span>
        <span className={styles.workoutType}>{latestSession.workoutTypeLabel}</span>
      </div>

      <p className={styles.date}>{formatDate(latestSession.occurredAt)}</p>

      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {latestSession.totalLbsLifted.toLocaleString("en-US")}
          </span>
          <span className={styles.statLabel}>lbs lifted</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {latestSession.totalSets.toLocaleString("en-US")}
          </span>
          <span className={styles.statLabel}>sets</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {latestSession.totalReps.toLocaleString("en-US")}
          </span>
          <span className={styles.statLabel}>reps</span>
        </div>
      </div>

      <div className={styles.comparison} data-direction={direction}>
        <span className={styles.comparisonIcon}>
          {direction === "up" && <TrendingUp size={18} strokeWidth={2} />}
          {direction === "down" && <TrendingDown size={18} strokeWidth={2} />}
          {(direction === "flat" || direction === "none") && (
            <Minus size={18} strokeWidth={2} />
          )}
        </span>
        <span className={styles.comparisonText}>
          {delta != null ? formatSignedDelta(delta) : null}
          {delta == null && (
            <span className={styles.comparisonDescription}>
              {sessionComparison?.description ?? "No comparison available."}
            </span>
          )}
        </span>
        {delta != null && (
          <span className={styles.comparisonDescription}>
            {sessionComparison?.description}
          </span>
        )}
      </div>
    </div>
  );
}
