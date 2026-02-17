"use client";

import { NeonTypingButton } from "../../../style-guide";
import type {
  DashboardFilterState,
  DashboardWorkoutTypeOption,
} from "../../../workouts/dashboard-analytics";
import styles from "./dashboard-filter-bar.module.css";

interface DashboardFilterBarProps {
  filter: DashboardFilterState;
  workoutTypeOptions: DashboardWorkoutTypeOption[];
}

export function DashboardFilterBar({ filter, workoutTypeOptions }: DashboardFilterBarProps) {
  return (
    <form method="get" action="/dashboard" className={styles.filterBar}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="dfb-workoutType">
          Workout type
        </label>
        <select
          id="dfb-workoutType"
          name="workoutType"
          defaultValue={filter.workoutType ?? "all"}
          className={styles.select}
        >
          <option value="all">All workout types</option>
          {workoutTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="dfb-startDate">
          Start date
        </label>
        <input
          id="dfb-startDate"
          name="startDate"
          type="date"
          defaultValue={filter.startDate ?? ""}
          className={styles.dateInput}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="dfb-endDate">
          End date
        </label>
        <input
          id="dfb-endDate"
          name="endDate"
          type="date"
          defaultValue={filter.endDate ?? ""}
          className={styles.dateInput}
        />
      </div>

      <div className={styles.actions}>
        <NeonTypingButton
          type="submit"
          text="Apply filters"
          glowColor="#ccff00"
          revealTextColor="#ccff00"
          cursorColor="#ccff00"
        />
        <a href="/dashboard" className={styles.resetLink}>
          Reset
        </a>
      </div>
    </form>
  );
}
