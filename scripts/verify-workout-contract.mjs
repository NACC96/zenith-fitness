import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const samplesPath = path.join(rootDir, "src/workouts/verification-samples.json");
const schemaPath = path.join(rootDir, "db/schema/workouts.sql");

const requiredTypes = new Set(["chest", "back", "legs"]);
const validStatuses = new Set(["parsed", "parsed_with_warnings", "failed"]);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const sum = (values) => values.reduce((acc, value) => acc + value, 0);

const fileContents = fs.readFileSync(samplesPath, "utf8");
const samplePayload = JSON.parse(fileContents);

assert(Array.isArray(samplePayload.samples), "samples must be an array.");
assert(samplePayload.samples.length >= 3, "at least three sample logs are required.");

const seenTypes = new Set();

for (const sample of samplePayload.samples) {
  const request = sample.request;
  const response = sample.response;

  assert(request.rawText?.trim(), `${sample.name}: request.rawText is required.`);
  assert(
    request.ingestionMode === "auto_save",
    `${sample.name}: ingestionMode must be auto_save.`
  );
  assert(
    typeof request.submittedAt === "string" && !Number.isNaN(Date.parse(request.submittedAt)),
    `${sample.name}: submittedAt must be ISO datetime.`
  );

  seenTypes.add(request.workoutTypeHintSlug);

  assert(
    typeof response.rawLogId === "string" && response.rawLogId.length > 0,
    `${sample.name}: response.rawLogId is required.`
  );
  assert(
    Number.isInteger(response.parseVersion) && response.parseVersion > 0,
    `${sample.name}: response.parseVersion must be a positive integer.`
  );
  assert(validStatuses.has(response.status), `${sample.name}: invalid response.status.`);
  assert(response.autoSaved === true, `${sample.name}: response.autoSaved must be true.`);

  const parse = response.parse;
  assert(
    parse.overallConfidence >= 0 && parse.overallConfidence <= 1,
    `${sample.name}: parse.overallConfidence must be between 0 and 1.`
  );
  assert(Array.isArray(parse.fieldConfidence), `${sample.name}: fieldConfidence must be an array.`);
  assert(Array.isArray(parse.errors), `${sample.name}: parse.errors must be an array.`);
  assert(Array.isArray(parse.warnings), `${sample.name}: parse.warnings must be an array.`);

  const parsedSession = parse.session;
  assert(parsedSession, `${sample.name}: parse.session is required for these fixtures.`);

  const sessionCore = parsedSession.session;
  assert(sessionCore.id, `${sample.name}: session.id is required.`);
  assert(sessionCore.rawLogId === response.rawLogId, `${sample.name}: rawLogId mismatch.`);
  assert(
    Number.isInteger(sessionCore.parseVersion) && sessionCore.parseVersion > 0,
    `${sample.name}: session.parseVersion must be a positive integer.`
  );

  const exercises = parsedSession.exercisePerformances;
  assert(Array.isArray(exercises) && exercises.length > 0, `${sample.name}: exercises required.`);

  const exerciseDerivedTotals = exercises.map((exercise) => {
    const sets = exercise.setEntries;
    assert(Array.isArray(sets) && sets.length > 0, `${sample.name}: setEntries required.`);

    const totalSets = sets.length;
    const totalReps = sum(sets.map((setEntry) => setEntry.reps));
    const totalVolume = sum(sets.map((setEntry) => setEntry.reps * setEntry.weightLbs));

    assert(exercise.totalSets === totalSets, `${sample.name}: exercise totalSets mismatch.`);
    assert(exercise.totalReps === totalReps, `${sample.name}: exercise totalReps mismatch.`);
    assert(
      exercise.totalVolumeLbs === totalVolume,
      `${sample.name}: exercise totalVolumeLbs mismatch.`
    );

    return {
      exerciseKey: exercise.exerciseKey,
      totalSets,
      totalReps,
      totalVolume,
    };
  });

  const metrics = parsedSession.metrics;
  const aggregateSets = sum(exerciseDerivedTotals.map((entry) => entry.totalSets));
  const aggregateReps = sum(exerciseDerivedTotals.map((entry) => entry.totalReps));
  const aggregateVolume = sum(exerciseDerivedTotals.map((entry) => entry.totalVolume));

  assert(metrics.totalSets === aggregateSets, `${sample.name}: metrics totalSets mismatch.`);
  assert(metrics.totalReps === aggregateReps, `${sample.name}: metrics totalReps mismatch.`);
  assert(
    metrics.totalLbsLifted === aggregateVolume,
    `${sample.name}: metrics totalLbsLifted mismatch.`
  );
  assert(
    Array.isArray(metrics.perExerciseProgression) &&
      metrics.perExerciseProgression.length === exercises.length,
    `${sample.name}: perExerciseProgression must include every exercise.`
  );
}

for (const requiredType of requiredTypes) {
  assert(seenTypes.has(requiredType), `missing ${requiredType} sample.`);
}

const sqlSchema = fs.readFileSync(schemaPath, "utf8").toLowerCase();
assert(
  sqlSchema.includes("create table if not exists workout_types"),
  "schema must define workout_types table."
);
assert(
  !sqlSchema.includes("create type workout_type"),
  "schema must not require enum changes for new workout types."
);
assert(
  sqlSchema.includes("insert into workout_types"),
  "schema must seed built-in workout types."
);

console.log("Workout model + ingestion contract verification passed.");
