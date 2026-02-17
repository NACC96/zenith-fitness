'use client';

import type { DashboardTrendStats } from '../../../workouts/dashboard-analytics';
import styles from './dashboard-trend-panel.module.css';

interface DashboardTrendPanelProps {
  trendStats: DashboardTrendStats;
}

function formatWindowDate(value: string | null): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMono(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatSignedDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function DashboardTrendPanel({ trendStats }: DashboardTrendPanelProps) {
  const hasDelta = trendStats.totalLbsDelta != null;
  const isPositive = hasDelta && (trendStats.totalLbsDelta as number) >= 0;

  return (
    <div className={styles.panel}>
      <div className={styles.strip}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Window</span>
          <span className={styles.metricValue}>
            {formatWindowDate(trendStats.windowStartOccurredAt)}
            <span className={styles.separator}> – </span>
            {formatWindowDate(trendStats.windowEndOccurredAt)}
          </span>
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total lbs change</span>
          {hasDelta ? (
            <span
              className={`${styles.deltaBadge} ${isPositive ? styles.deltaBadgePositive : styles.deltaBadgeNegative}`}
            >
              {formatSignedDelta(trendStats.totalLbsDelta as number)} lbs
            </span>
          ) : (
            <span className={styles.metricMono}>N/A</span>
          )}
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg lbs / session</span>
          <span className={styles.metricMono}>{formatMono(trendStats.averageLbsPerSession)}</span>
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg sets / session</span>
          <span className={styles.metricMono}>{formatMono(trendStats.averageSetsPerSession)}</span>
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg reps / session</span>
          <span className={styles.metricMono}>{formatMono(trendStats.averageRepsPerSession)}</span>
        </div>
      </div>
    </div>
  );
}

export default DashboardTrendPanel;
