'use client';

import type { DashboardExerciseProgressionRow } from '../../../workouts/dashboard-analytics';
import styles from './dashboard-progression.module.css';

interface DashboardProgressionProps {
  progression: DashboardExerciseProgressionRow[];
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatDelta(value: number, unit: string): React.ReactNode {
  const sign = value > 0 ? '+' : '';
  const className =
    value > 0 ? styles.deltaPositive : value < 0 ? styles.deltaNegative : styles.deltaZero;
  return (
    <span className={`${styles.delta} ${className}`}>
      {sign}{value.toFixed(value % 1 === 0 ? 0 : 2)} {unit}
    </span>
  );
}

export function DashboardProgression({ progression }: DashboardProgressionProps) {
  if (progression.length === 0) {
    return null;
  }

  return (
    <div className={styles.grid}>
      {progression.map((row, index) => (
        <div
          key={row.exerciseKey}
          className={styles.card}
        >
          <h3 className={styles.exerciseName}>{row.exerciseName}</h3>

          <div className={styles.statsRow}>
            <div className={styles.statBlock}>
              <p className={styles.statValue}>{formatNumber(row.totalVolumeLbs)}</p>
              <p className={styles.statLabel}>lbs volume</p>
            </div>
            <div className={styles.statBlock}>
              <p className={styles.statValue}>{formatNumber(row.totalReps)}</p>
              <p className={styles.statLabel}>reps</p>
            </div>
          </div>

          <div className={styles.deltasRow}>
            {formatDelta(row.volumeDeltaLbs, 'lbs')}
            {formatDelta(row.repDelta, 'reps')}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DashboardProgression;
