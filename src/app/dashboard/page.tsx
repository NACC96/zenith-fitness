import {
  buildDashboardAnalyticsView,
  type DashboardFilterInput,
} from "../../workouts/dashboard-analytics";
import { getDefaultWorkoutIngestionRepository } from "../../workouts/ingestion-endpoint";

type SearchParamValue = string | string[] | undefined;

interface DashboardPageProps {
  searchParams?: Record<string, SearchParamValue>;
}

const firstQueryValue = (value: SearchParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value: number): string => value.toLocaleString("en-US");

const formatSignedDelta = (value: number | null): string => {
  if (value == null) {
    return "N/A";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
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

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const filterInput = toDashboardFilterInput(searchParams);
  const correctionState = firstQueryValue(searchParams?.correction);
  const correctionError = firstQueryValue(searchParams?.error);
  const correctionParseVersion = firstQueryValue(searchParams?.parseVersion);
  const correctionComputationVersion = firstQueryValue(searchParams?.computationVersion);
  const view = await buildDashboardAnalyticsView({
    repository: getDefaultWorkoutIngestionRepository(),
    filter: filterInput,
  });

  return (
    <main style={{ margin: "2rem auto", maxWidth: 1100, fontFamily: "sans-serif" }}>
      <h1>Workout Analytics Dashboard</h1>
      <p>
        Filter by workout type and date range to inspect latest-session metrics, trends,
        AI insights, and correction history.
      </p>
      {correctionState === "applied" ? (
        <p style={{ marginTop: "0.75rem", color: "green" }}>
          Correction applied. Parse version {correctionParseVersion ?? "N/A"}, computation
          version {correctionComputationVersion ?? "N/A"}.
        </p>
      ) : null}
      {correctionState === "error" ? (
        <p style={{ marginTop: "0.75rem", color: "crimson" }}>
          Correction failed: {correctionError ?? "Unknown correction error."}
        </p>
      ) : null}

      <form method="get" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <label>
          Workout type
          <select name="workoutType" defaultValue={view.filter.workoutType ?? "all"}>
            <option value="all">All workout types</option>
            {view.workoutTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start date
          <input name="startDate" type="date" defaultValue={view.filter.startDate ?? ""} />
        </label>
        <label>
          End date
          <input name="endDate" type="date" defaultValue={view.filter.endDate ?? ""} />
        </label>
        <button type="submit">Apply filters</button>
        <a href="/dashboard" style={{ alignSelf: "end" }}>
          Reset
        </a>
      </form>

      {view.isEmpty ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>No sessions found</h2>
          <p>{view.emptyStateMessage}</p>
        </section>
      ) : (
        <>
          <section style={{ marginTop: "1.5rem" }}>
            <h2>Key Stats</h2>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <article>
                <h3>Total lbs lifted</h3>
                <p>{formatNumber(view.keyStats.totalLbsLifted)}</p>
              </article>
              <article>
                <h3>Total sets</h3>
                <p>{formatNumber(view.keyStats.totalSets)}</p>
              </article>
              <article>
                <h3>Total reps</h3>
                <p>{formatNumber(view.keyStats.totalReps)}</p>
              </article>
              <article>
                <h3>Sessions</h3>
                <p>{formatNumber(view.keyStats.totalSessions)}</p>
              </article>
            </div>
          </section>

          {view.latestSession ? (
            <section style={{ marginTop: "1.5rem" }}>
              <h2>Latest Session Summary</h2>
              <p>
                {view.latestSession.workoutTypeLabel} on {formatDate(view.latestSession.occurredAt)}
              </p>
              <p>
                {formatNumber(view.latestSession.totalLbsLifted)} lbs,{" "}
                {formatNumber(view.latestSession.totalSets)} sets,{" "}
                {formatNumber(view.latestSession.totalReps)} reps
              </p>
            </section>
          ) : null}

          {view.sessionComparison ? (
            <section style={{ marginTop: "1.5rem" }}>
              <h2>Session Comparison</h2>
              <p>{view.sessionComparison.description}</p>
              <p>
                Previous-session delta (lbs):{" "}
                {formatSignedDelta(view.sessionComparison.previousSessionTotalLbsDelta)}
              </p>
            </section>
          ) : null}

          <section style={{ marginTop: "1.5rem" }}>
            <h2>AI Session Insights</h2>
            {view.sessionInsights.length === 0 ? (
              <p>No insights available for the current filters.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Session</th>
                    <th align="left">Mode</th>
                    <th align="left">Headline</th>
                    <th align="left">Summary</th>
                    <th align="left">Recommendations</th>
                    <th align="left">Anomalies</th>
                  </tr>
                </thead>
                <tbody>
                  {view.sessionInsights.map((insight) => (
                    <tr key={insight.sessionId}>
                      <td>
                        {formatDate(
                          view.sessionHistory.find((row) => row.sessionId === insight.sessionId)
                            ?.occurredAt ?? insight.sessionId
                        )}
                      </td>
                      <td>{insight.mode}</td>
                      <td>{insight.headline}</td>
                      <td>{insight.summary}</td>
                      <td>
                        {insight.recommendations.length > 0
                          ? insight.recommendations.join(" ")
                          : "Suppressed"}
                      </td>
                      <td>
                        {insight.anomalies.length > 0
                          ? insight.anomalies.join(" ")
                          : "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Historical Trend</h2>
            <p>
              Window: {view.trendStats.windowStartOccurredAt
                ? formatDate(view.trendStats.windowStartOccurredAt)
                : "N/A"}{" "}
              to{" "}
              {view.trendStats.windowEndOccurredAt
                ? formatDate(view.trendStats.windowEndOccurredAt)
                : "N/A"}
            </p>
            <p>
              Total lbs change:{" "}
              {view.trendStats.totalLbsDelta == null
                ? "N/A"
                : formatSignedDelta(view.trendStats.totalLbsDelta)}
            </p>
            <p>
              Average per session: {formatNumber(view.trendStats.averageLbsPerSession)} lbs /{" "}
              {formatNumber(view.trendStats.averageSetsPerSession)} sets /{" "}
              {formatNumber(view.trendStats.averageRepsPerSession)} reps
            </p>
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Session History</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Date</th>
                  <th align="left">Workout type</th>
                  <th align="right">Parse v</th>
                  <th align="right">Compute v</th>
                  <th align="right">Total lbs</th>
                  <th align="right">Sets</th>
                  <th align="right">Reps</th>
                  <th align="right">Prev delta (lbs)</th>
                </tr>
              </thead>
              <tbody>
                {view.sessionHistory.map((row) => (
                  <tr key={row.sessionId}>
                    <td>{formatDate(row.occurredAt)}</td>
                    <td>{row.workoutTypeLabel}</td>
                    <td align="right">{formatNumber(row.parseVersion)}</td>
                    <td align="right">{formatNumber(row.computationVersion)}</td>
                    <td align="right">{formatNumber(row.totalLbsLifted)}</td>
                    <td align="right">{formatNumber(row.totalSets)}</td>
                    <td align="right">{formatNumber(row.totalReps)}</td>
                    <td align="right">{formatSignedDelta(row.previousSessionTotalLbsDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Correct Parsed Session</h2>
            <p>
              Adjust one set entry (reps and weight). Corrections are audited and trigger
              deterministic recomputation.
            </p>
            {view.sessionHistory.length === 0 ? (
              <p>No sessions available to correct.</p>
            ) : (
              <form
                method="post"
                action="/api/workouts/corrections"
                style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
              >
                <input type="hidden" name="redirectTo" value="/dashboard" />
                <label>
                  Session
                  <select name="sessionRef" required defaultValue="">
                    <option value="" disabled>
                      Select session
                    </option>
                    {view.sessionHistory.map((row) => (
                      <option
                        key={row.sessionId}
                        value={`${row.sessionId}::${row.rawLogId}`}
                      >
                        {formatDate(row.occurredAt)} - {row.workoutTypeLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason
                  <input
                    type="text"
                    name="reason"
                    required
                    defaultValue="Manual correction"
                  />
                </label>
                <label>
                  Exercise index
                  <input type="number" name="exerciseIndex" min={1} defaultValue={1} required />
                </label>
                <label>
                  Set index
                  <input type="number" name="setIndex" min={1} defaultValue={1} required />
                </label>
                <label>
                  Reps
                  <input type="number" name="reps" min={1} step={1} required />
                </label>
                <label>
                  Weight (lbs)
                  <input type="number" name="weightLbs" min={0} step={0.5} required />
                </label>
                <button type="submit">Apply correction</button>
              </form>
            )}
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Per-Exercise Progression (Latest Session)</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Exercise</th>
                  <th align="right">Volume (lbs)</th>
                  <th align="right">Reps</th>
                  <th align="right">Volume Δ (lbs)</th>
                  <th align="right">Rep Δ</th>
                </tr>
              </thead>
              <tbody>
                {view.progression.map((row) => (
                  <tr key={row.exerciseKey}>
                    <td>{row.exerciseName}</td>
                    <td align="right">{formatNumber(row.totalVolumeLbs)}</td>
                    <td align="right">{formatNumber(row.totalReps)}</td>
                    <td align="right">{formatSignedDelta(row.volumeDeltaLbs)}</td>
                    <td align="right">{formatSignedDelta(row.repDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
