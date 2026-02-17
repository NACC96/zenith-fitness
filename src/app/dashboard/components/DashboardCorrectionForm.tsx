'use client';

import { NeonTypingButton } from '../../../style-guide';
import type { DashboardSessionHistoryRow } from '../../../workouts/dashboard-analytics';
import styles from './dashboard-correction-form.module.css';

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface DashboardCorrectionFormProps {
  sessionHistory: DashboardSessionHistoryRow[];
  correctionState?: string;
  correctionError?: string;
}

export function DashboardCorrectionForm({
  sessionHistory,
  correctionState,
  correctionError,
}: DashboardCorrectionFormProps) {
  return (
    <div className={styles.wrapper}>
      {correctionState === 'applied' && (
        <div className={styles.bannerSuccess} role="status">
          Correction applied successfully.
        </div>
      )}
      {correctionState === 'error' && (
        <div className={styles.bannerError} role="alert">
          {correctionError ?? 'Unknown correction error.'}
        </div>
      )}

      {sessionHistory.length === 0 ? (
        <p className={styles.emptyState}>No sessions available to correct.</p>
      ) : (
        <form
          method="post"
          action="/api/workouts/corrections"
          className={styles.form}
        >
          <input type="hidden" name="redirectTo" value="/dashboard" />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-sessionRef">
              Session
            </label>
            <select
              id="dcf-sessionRef"
              name="sessionRef"
              required
              defaultValue=""
              className={styles.select}
            >
              <option value="" disabled>
                Select session
              </option>
              {sessionHistory.map((row) => (
                <option
                  key={row.sessionId}
                  value={`${row.sessionId}::${row.rawLogId}`}
                >
                  {formatDate(row.occurredAt)} — {row.workoutTypeLabel}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-reason">
              Reason
            </label>
            <input
              id="dcf-reason"
              type="text"
              name="reason"
              required
              defaultValue="Manual correction"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-exerciseIndex">
              Exercise index
            </label>
            <input
              id="dcf-exerciseIndex"
              type="number"
              name="exerciseIndex"
              min={1}
              defaultValue={1}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-setIndex">
              Set index
            </label>
            <input
              id="dcf-setIndex"
              type="number"
              name="setIndex"
              min={1}
              defaultValue={1}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-reps">
              Reps
            </label>
            <input
              id="dcf-reps"
              type="number"
              name="reps"
              min={1}
              step={1}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dcf-weightLbs">
              Weight (lbs)
            </label>
            <input
              id="dcf-weightLbs"
              type="number"
              name="weightLbs"
              min={0}
              step={0.5}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.actions}>
            <NeonTypingButton
              type="submit"
              text="Apply correction"
              glowColor="#ccff00"
              revealTextColor="#ccff00"
              cursorColor="#ccff00"
            />
          </div>
        </form>
      )}
    </div>
  );
}

export default DashboardCorrectionForm;
