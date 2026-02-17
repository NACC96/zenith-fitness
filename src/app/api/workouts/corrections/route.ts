import {
  createDefaultWorkoutCorrectionService,
  ensureDefaultWorkoutMockDataSeeded,
  createWorkoutCorrectionPostHandler,
} from "../../../../workouts/ingestion-endpoint";

const service = createDefaultWorkoutCorrectionService();
const postWorkoutCorrection = createWorkoutCorrectionPostHandler(service);

export const POST = async (request: Request): Promise<Response> => {
  await ensureDefaultWorkoutMockDataSeeded();
  return postWorkoutCorrection(request);
};
