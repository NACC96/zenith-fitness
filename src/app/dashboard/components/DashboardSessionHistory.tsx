"use client";

import type { DashboardSessionHistoryRow } from "../../../workouts/dashboard-analytics";
import styles from "./dashboard-session-history.module.css";

interface DashboardSessionHistoryProps {
  sessionHistory: DashboardSessionHistoryRow[];
}

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value: number): string => value.toLocaleString("en-US");

const DeltaCell = ({ value }: { value: number | null }) => {
  if (value == null) {
    return <td className={styles.deltaNone}>—</td>;
  }
  const sign = value > 0 ? "+" : "";
  const formatted = `${sign}${value.toFixed(2)}`;
  if (value > 0) return <td className={styles.deltaPositive}>{formatted}</td>;
  if (value < 0) return <td className={styles.deltaNegative}>{formatted}</td>;
  return <td className={styles.deltaNone}>{formatted}</td>;
};

export function DashboardSessionHistory({ sessionHistory }: DashboardSessionHistoryProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.scrollWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Type</th>
              <th className={`${styles.th} ${styles.right}`}>Parse v</th>
              <th className={`${styles.th} ${styles.right}`}>Compute v</th>
              <th className={`${styles.th} ${styles.right}`}>Total lbs</th>
              <th className={`${styles.th} ${styles.right}`}>Sets</th>
              <th className={`${styles.th} ${styles.right}`}>Reps</th>
              <th className={`${styles.th} ${styles.right}`}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {sessionHistory.map((row) => (
              <tr key={row.sessionId} className={styles.tr}>
                <td className={styles.td}>{formatDate(row.occurredAt)}</td>
                <td className={styles.td}>{row.workoutTypeLabel}</td>
                <td className={`${styles.td} ${styles.mono}`}>{formatNumber(row.parseVersion)}</td>
                <td className={`${styles.td} ${styles.mono}`}>
                  {formatNumber(row.computationVersion)}
                </td>
                <td className={`${styles.td} ${styles.mono}`}>
                  {formatNumber(row.totalLbsLifted)}
                </td>
                <td className={`${styles.td} ${styles.mono}`}>{formatNumber(row.totalSets)}</td>
                <td className={`${styles.td} ${styles.mono}`}>{formatNumber(row.totalReps)}</td>
                <DeltaCell value={row.previousSessionTotalLbsDelta} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
