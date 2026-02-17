import {
  createDefaultWorkoutIngestionService,
  ensureDefaultWorkoutMockDataSeeded,
  createWorkoutIngestionPostHandler,
} from "../../../../workouts/ingestion-endpoint";

const service = createDefaultWorkoutIngestionService();
const postWorkoutIngestion = createWorkoutIngestionPostHandler(service);

export const POST = async (request: Request): Promise<Response> => {
  await ensureDefaultWorkoutMockDataSeeded();
  return postWorkoutIngestion(request);
};
