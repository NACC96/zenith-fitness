import type {
  WorkoutIngestionRequest,
  WorkoutIngestionResponse,
} from "./ingestion-contract";
import type { ISODateTimeString, ParsedWorkoutSession } from "./model";
import {
  filterParsedSessions,
  findMostRecentSessionBefore as findPreviousSessionByOccurredAt,
  type WorkoutSessionFilter,
} from "./metrics-engine";
import type { OpenRouterModelResponseLog } from "./openrouter-client";

export interface PersistIngestionRecordInput {
  idempotencyKey: string;
  request: WorkoutIngestionRequest;
  response: WorkoutIngestionResponse;
  persistedAt: ISODateTimeString;
  modelLog: OpenRouterModelResponseLog;
}

export interface WorkoutIngestionRepository {
  findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WorkoutIngestionResponse | null>;
  findMostRecentSessionBefore(input: {
    workoutTypeId: string;
    occurredAt: ISODateTimeString;
  }): Promise<ParsedWorkoutSession | null>;
  listParsedSessions(filter?: WorkoutSessionFilter): Promise<ParsedWorkoutSession[]>;
  persistIngestionRecord(input: PersistIngestionRecordInput): Promise<void>;
}

export class InMemoryWorkoutIngestionRepository
  implements WorkoutIngestionRepository
{
  private readonly responsesByIdempotencyKey = new Map<
    string,
    WorkoutIngestionResponse
  >();

  private readonly persistedRecords: PersistIngestionRecordInput[] = [];

  async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WorkoutIngestionResponse | null> {
    const existing = this.responsesByIdempotencyKey.get(idempotencyKey);
    return existing ? structuredClone(existing) : null;
  }

  async findMostRecentSessionBefore(input: {
    workoutTypeId: string;
    occurredAt: ISODateTimeString;
  }): Promise<ParsedWorkoutSession | null> {
    return (
      findPreviousSessionByOccurredAt(this.readParsedSessions(), input) ?? null
    );
  }

  async listParsedSessions(
    filter: WorkoutSessionFilter = {}
  ): Promise<ParsedWorkoutSession[]> {
    return filterParsedSessions(this.readParsedSessions(), filter);
  }

  async persistIngestionRecord(input: PersistIngestionRecordInput): Promise<void> {
    if (this.responsesByIdempotencyKey.has(input.idempotencyKey)) {
      return;
    }

    this.responsesByIdempotencyKey.set(
      input.idempotencyKey,
      structuredClone(input.response)
    );
    this.persistedRecords.push(structuredClone(input));
  }

  // Verification helper for scripts/tests.
  snapshot(): PersistIngestionRecordInput[] {
    return structuredClone(this.persistedRecords);
  }

  private readParsedSessions(): ParsedWorkoutSession[] {
    return this.persistedRecords
      .map((record) => record.response.parse.session)
      .filter((session): session is ParsedWorkoutSession => Boolean(session))
      .map((session) => structuredClone(session));
  }
}

export interface SqlQueryRunner {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

interface RawLogLookupRow {
  latest_response: WorkoutIngestionResponse;
}

export class PostgresWorkoutIngestionRepository
  implements WorkoutIngestionRepository
{
  private readonly db: SqlQueryRunner;

  constructor(db: SqlQueryRunner) {
    this.db = db;
  }

  private toParsedSession(
    response: WorkoutIngestionResponse
  ): ParsedWorkoutSession | null {
    return response.parse.session ? structuredClone(response.parse.session) : null;
  }

  async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WorkoutIngestionResponse | null> {
    const result = await this.db.query<RawLogLookupRow>(
      `
      select latest_response
      from workout_raw_logs
      where idempotency_key = $1
      limit 1
      `,
      [idempotencyKey]
    );

    return result.rows[0]?.latest_response ?? null;
  }

  async findMostRecentSessionBefore(input: {
    workoutTypeId: string;
    occurredAt: ISODateTimeString;
  }): Promise<ParsedWorkoutSession | null> {
    const result = await this.db.query<RawLogLookupRow>(
      `
      select latest_response
      from workout_raw_logs
      where latest_response->'parse'->'session' is not null
        and latest_response->'parse'->'session' <> 'null'::jsonb
        and latest_response->'parse'->'session'->'session'->>'workoutTypeId' = $1
        and (
          latest_response->'parse'->'session'->'session'->>'occurredAt'
        )::timestamptz < $2::timestamptz
      order by
        (
          latest_response->'parse'->'session'->'session'->>'occurredAt'
        )::timestamptz desc,
        latest_response->>'rawLogId' desc
      limit 1
      `,
      [input.workoutTypeId, input.occurredAt]
    );

    const previousResponse = result.rows[0]?.latest_response;
    return previousResponse ? this.toParsedSession(previousResponse) : null;
  }

  async listParsedSessions(
    filter: WorkoutSessionFilter = {}
  ): Promise<ParsedWorkoutSession[]> {
    const result = await this.db.query<RawLogLookupRow>(
      `
      select latest_response
      from workout_raw_logs
      where latest_response->'parse'->'session' is not null
        and latest_response->'parse'->'session' <> 'null'::jsonb
        and (
          $1::text is null or
          latest_response->'parse'->'session'->'session'->>'workoutTypeId' = $1
        )
        and (
          $2::timestamptz is null or
          (
            latest_response->'parse'->'session'->'session'->>'occurredAt'
          )::timestamptz >= $2::timestamptz
        )
        and (
          $3::timestamptz is null or
          (
            latest_response->'parse'->'session'->'session'->>'occurredAt'
          )::timestamptz <= $3::timestamptz
        )
      order by
        (
          latest_response->'parse'->'session'->'session'->>'occurredAt'
        )::timestamptz asc,
        latest_response->>'rawLogId' asc
      `,
      [
        filter.workoutTypeId ?? null,
        filter.startOccurredAt ?? null,
        filter.endOccurredAt ?? null,
      ]
    );

    return result.rows
      .map((row) => this.toParsedSession(row.latest_response))
      .filter((session): session is ParsedWorkoutSession => Boolean(session));
  }

  async persistIngestionRecord(input: PersistIngestionRecordInput): Promise<void> {
    const { response, request, persistedAt, modelLog } = input;
    const session = response.parse.session?.session;
    const exercisePerformances = response.parse.session?.exercisePerformances ?? [];
    const metrics = response.parse.session?.metrics;

    await this.db.query("begin");

    try {
      await this.db.query(
        `
        insert into workout_raw_logs (
          id,
          raw_text,
          submitted_at,
          ingestion_mode,
          parse_status,
          overall_confidence,
          source,
          idempotency_key,
          latest_response,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3::timestamptz,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10::timestamptz,
          $11::timestamptz
        )
        `,
        [
          response.rawLogId,
          request.rawText,
          request.submittedAt,
          request.ingestionMode,
          response.status,
          response.parse.overallConfidence,
          "openrouter",
          input.idempotencyKey,
          JSON.stringify(response),
          persistedAt,
          persistedAt,
        ]
      );

      if (session) {
        await this.db.query(
          `
          insert into workout_sessions (
            id,
            raw_log_id,
            workout_type_id,
            occurred_at,
            timezone,
            parse_version,
            notes,
            created_at,
            updated_at
          ) values (
            $1,
            $2,
            $3,
            $4::timestamptz,
            $5,
            $6,
            $7,
            $8::timestamptz,
            $9::timestamptz
          )
          `,
          [
            session.id,
            response.rawLogId,
            session.workoutTypeId,
            session.occurredAt,
            session.timezone ?? null,
            session.parseVersion,
            session.notes ?? null,
            persistedAt,
            persistedAt,
          ]
        );

        for (const exercise of exercisePerformances) {
          await this.db.query(
            `
            insert into exercise_performances (
              id,
              session_id,
              exercise_key,
              exercise_name,
              exercise_order,
              total_sets,
              total_reps,
              total_volume_lbs,
              previous_session_volume_delta_lbs
            ) values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9
            )
            `,
            [
              exercise.id,
              session.id,
              exercise.exerciseKey,
              exercise.exerciseName,
              exercise.exerciseOrder,
              exercise.totalSets,
              exercise.totalReps,
              exercise.totalVolumeLbs,
              exercise.previousSessionVolumeDeltaLbs ?? null,
            ]
          );

          for (const setEntry of exercise.setEntries) {
            await this.db.query(
              `
              insert into set_entries (
                id,
                exercise_performance_id,
                set_index,
                reps,
                weight_lbs,
                is_warmup,
                rpe,
                notes
              ) values (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
              )
              `,
              [
                setEntry.id,
                exercise.id,
                setEntry.setIndex,
                setEntry.reps,
                setEntry.weightLbs,
                setEntry.isWarmup ?? false,
                setEntry.rpe ?? null,
                setEntry.notes ?? null,
              ]
            );
          }
        }

        if (metrics) {
          await this.db.query(
            `
            insert into session_metrics (
              session_id,
              total_lbs_lifted,
              total_sets,
              total_reps,
              previous_session_total_lbs_delta,
              per_exercise_progression,
              computed_at
            ) values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::jsonb,
              $7::timestamptz
            )
            `,
            [
              session.id,
              metrics.totalLbsLifted,
              metrics.totalSets,
              metrics.totalReps,
              metrics.previousSessionTotalLbsDelta ?? null,
              JSON.stringify(metrics.perExerciseProgression),
              persistedAt,
            ]
          );
        }
      }

      await this.db.query(
        `
        insert into parse_payload_versions (
          raw_log_id,
          session_id,
          version_number,
          parsed_payload,
          field_confidence,
          parse_errors,
          parse_warnings,
          created_at
        ) values (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::timestamptz
        )
        `,
        [
          response.rawLogId,
          response.sessionId ?? null,
          response.parseVersion,
          JSON.stringify(response.parse.session ?? null),
          JSON.stringify(response.parse.fieldConfidence),
          JSON.stringify(response.parse.errors),
          JSON.stringify(response.parse.warnings),
          persistedAt,
        ]
      );

      await this.db.query(
        `
        insert into openrouter_model_logs (
          raw_log_id,
          parse_version,
          model,
          attempt,
          request_started_at,
          request_completed_at,
          duration_ms,
          response_status,
          request_payload,
          response_payload,
          error_message,
          logged_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5::timestamptz,
          $6::timestamptz,
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          $11,
          $12::timestamptz
        )
        `,
        [
          response.rawLogId,
          response.parseVersion,
          modelLog.model,
          modelLog.attempt,
          modelLog.requestStartedAt,
          modelLog.requestCompletedAt,
          modelLog.durationMs,
          modelLog.responseStatus ?? null,
          JSON.stringify(modelLog.requestPayload ?? {}),
          JSON.stringify(modelLog.responsePayload ?? null),
          modelLog.errorMessage ?? null,
          modelLog.loggedAt,
        ]
      );

      await this.db.query("commit");
    } catch (error) {
      await this.db.query("rollback");
      throw error;
    }
  }
}
