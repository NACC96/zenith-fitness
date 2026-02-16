import {
  createDefaultWorkoutIngestionService,
  createWorkoutIngestionPostHandler,
} from "../../../../workouts/ingestion-endpoint";

const service = createDefaultWorkoutIngestionService();

export const POST = createWorkoutIngestionPostHandler(service);
