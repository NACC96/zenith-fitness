import { buildDashboardAnalyticsView } from "../src/workouts/dashboard-analytics.ts";
import {
  ensureDefaultWorkoutMockDataSeeded,
  getDefaultWorkoutIngestionRepository,
} from "../src/workouts/ingestion-endpoint.ts";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const BUILTIN_WORKOUT_TYPES = ["chest", "back", "legs"] as const;

const main = async (): Promise<void> => {
  delete process.env.WORKOUT_MOCK_SEED;

  const repository = getDefaultWorkoutIngestionRepository();

  await ensureDefaultWorkoutMockDataSeeded();
  const firstPassSessions = await repository.listParsedSessions();
  assert(
    firstPassSessions.length === 6,
    `Expected six seeded sessions, got ${firstPassSessions.length}.`
  );

  const fullView = await buildDashboardAnalyticsView({ repository });
  assert(!fullView.isEmpty, "Dashboard should be populated after mock seeding.");

  for (const workoutType of BUILTIN_WORKOUT_TYPES) {
    assert(
      fullView.workoutTypeOptions.some((option) => option.value === workoutType),
      `Missing built-in workout filter option: ${workoutType}.`
    );

    const filteredView = await buildDashboardAnalyticsView({
      repository,
      filter: { workoutType },
    });

    assert(
      filteredView.sessionHistory.length === 2,
      `Expected two sessions for ${workoutType}, got ${filteredView.sessionHistory.length}.`
    );
  }

  await ensureDefaultWorkoutMockDataSeeded();
  const secondPassSessions = await repository.listParsedSessions();
  assert(
    secondPassSessions.length === 6,
    `Expected seeded session count to remain six after second ensure, got ${secondPassSessions.length}.`
  );

  console.log("Default mock seed verification passed.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
