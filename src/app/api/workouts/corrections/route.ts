import {
  createDefaultWorkoutCorrectionService,
  createWorkoutCorrectionPostHandler,
} from "../../../../workouts/ingestion-endpoint";

const service = createDefaultWorkoutCorrectionService();

export const POST = createWorkoutCorrectionPostHandler(service);
