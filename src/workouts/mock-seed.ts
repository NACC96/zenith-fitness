import type { WorkoutIngestionRepository } from "./ingestion-repository";
import { InMemoryWorkoutIngestionRepository } from "./ingestion-repository";
import { WorkoutIngestionService } from "./ingestion-service";
import {
  DEFAULT_BUILTIN_WORKOUT_FIXTURES,
  MockWorkoutFixtureParser,
  type MockSessionFixture,
} from "./mock-fixtures";

const SEED_DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

const defaultRepository = new InMemoryWorkoutIngestionRepository();
let seedInFlight: Promise<void> | null = null;

const shouldAutoSeedDefaultRepository = (): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const toggle = process.env.WORKOUT_MOCK_SEED;
  if (!toggle) {
    return true;
  }

  return !SEED_DISABLED_VALUES.has(toggle.trim().toLowerCase());
};

export interface SeedRepositoryWithFixturesInput {
  repository: WorkoutIngestionRepository;
  fixtures?: MockSessionFixture[];
  now?: () => Date;
  idGenerator?: () => string;
}

export const getDefaultWorkoutMockRepository =
  (): InMemoryWorkoutIngestionRepository => defaultRepository;

export const seedRepositoryWithFixtures = async ({
  repository,
  fixtures = DEFAULT_BUILTIN_WORKOUT_FIXTURES,
  now,
  idGenerator,
}: SeedRepositoryWithFixturesInput): Promise<void> => {
  const existingSessions = await repository.listParsedSessions();
  if (existingSessions.length > 0) {
    return;
  }

  const parser = new MockWorkoutFixtureParser(fixtures);
  const service = new WorkoutIngestionService({
    parser,
    repository,
    ...(now ? { now } : {}),
    ...(idGenerator ? { idGenerator } : {}),
  });

  for (const fixture of fixtures) {
    await service.ingest(fixture.request);
  }
};

export const ensureDefaultWorkoutMockDataSeeded = async (): Promise<void> => {
  if (!shouldAutoSeedDefaultRepository()) {
    return;
  }

  const existingSessions = await defaultRepository.listParsedSessions();
  if (existingSessions.length > 0) {
    return;
  }

  if (seedInFlight) {
    await seedInFlight;
    return;
  }

  const currentRun = seedRepositoryWithFixtures({
    repository: defaultRepository,
  });
  seedInFlight = currentRun;

  try {
    await currentRun;
  } finally {
    if (seedInFlight === currentRun) {
      seedInFlight = null;
    }
  }
};
