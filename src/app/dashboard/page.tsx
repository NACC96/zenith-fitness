import {
  buildDashboardAnalyticsView,
  type DashboardFilterInput,
} from "../../workouts/dashboard-analytics";
import {
  ensureDefaultWorkoutMockDataSeeded,
  getDefaultWorkoutIngestionRepository,
} from "../../workouts/ingestion-endpoint";
import { DashboardFilterBar } from "./components/DashboardFilterBar";
import { DashboardStatCards } from "./components/DashboardStatCards";
import { DashboardSessionSummary } from "./components/DashboardSessionSummary";
import { DashboardTrendPanel } from "./components/DashboardTrendPanel";
import { DashboardInsights } from "./components/DashboardInsights";
import { DashboardSessionHistory } from "./components/DashboardSessionHistory";
import { DashboardProgression } from "./components/DashboardProgression";
import { DashboardCorrectionForm } from "./components/DashboardCorrectionForm";
import styles from "./dashboard-page.module.css";

type SearchParamValue = string | string[] | undefined;

interface DashboardPageProps {
  searchParams?:
    | Promise<Record<string, SearchParamValue>>
    | Record<string, SearchParamValue>;
}

const firstQueryValue = (value: SearchParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const toDashboardFilterInput = (
  searchParams: Record<string, SearchParamValue> | undefined
): DashboardFilterInput => {
  return {
    workoutType: firstQueryValue(searchParams?.workoutType),
    startDate: firstQueryValue(searchParams?.startDate),
    endDate: firstQueryValue(searchParams?.endDate),
  };
};

const resolveSearchParams = async (
  searchParams: DashboardPageProps["searchParams"]
): Promise<Record<string, SearchParamValue>> => {
  const resolved = await searchParams;
  return resolved ?? {};
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await ensureDefaultWorkoutMockDataSeeded();

  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const filterInput = toDashboardFilterInput(resolvedSearchParams);
  const correctionState = firstQueryValue(resolvedSearchParams.correction);
  const correctionError = firstQueryValue(resolvedSearchParams.error);
  const view = await buildDashboardAnalyticsView({
    repository: getDefaultWorkoutIngestionRepository(),
    filter: filterInput,
  });

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workout Analytics</h1>
        <p className={styles.pageSubtitle}>
          Filter by workout type and date range to inspect latest-session metrics, trends,
          AI insights, and correction history.
        </p>
      </div>

      <section className={styles.section}>
        <DashboardFilterBar
          filter={view.filter}
          workoutTypeOptions={view.workoutTypeOptions}
        />
      </section>

      {view.isEmpty ? (
        <div className={styles.emptyPanel}>
          <p className={styles.emptyTitle}>No sessions found</p>
          <p className={styles.emptyMessage}>{view.emptyStateMessage}</p>
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Key Stats</h2>
            <DashboardStatCards keyStats={view.keyStats} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Latest Session</h2>
            <DashboardSessionSummary
              latestSession={view.latestSession}
              sessionComparison={view.sessionComparison}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Historical Trend</h2>
            <DashboardTrendPanel trendStats={view.trendStats} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>AI Session Insights</h2>
            <DashboardInsights
              sessionInsights={view.sessionInsights}
              sessionHistory={view.sessionHistory}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Session History</h2>
            <DashboardSessionHistory sessionHistory={view.sessionHistory} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Exercise Progression</h2>
            <DashboardProgression progression={view.progression} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Correct Parsed Session</h2>
            <DashboardCorrectionForm
              sessionHistory={view.sessionHistory}
              correctionState={correctionState}
              correctionError={correctionError}
            />
          </section>
        </>
      )}
    </main>
  );
}
