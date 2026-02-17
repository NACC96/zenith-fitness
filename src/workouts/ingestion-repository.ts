import type {
  WorkoutCorrectionPatch,
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

export interface PersistedCorrectionRecord {
  correctionId: string;
  rawLogId: string;
  sessionId: string;
  reason: string;
  patch: WorkoutCorrectionPatch[];
  status: "pending" | "applied" | "rejected";
  requestedAt: ISODateTimeString;
  appliedAt?: ISODateTimeString;
}

export interface PersistCorrectionRecordInput {
  correction: PersistedCorrectionRecord;
  updatedResponses: WorkoutIngestionResponse[];
  persistedAt: ISODateTimeString;
}

export interface WorkoutIngestionRepository {
  findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WorkoutIngestionResponse | null>;
  findBySessionId(sessionId: string): Promise<WorkoutIngestionResponse | null>;
  findMostRecentSessionBefore(input: {
    workoutTypeId: string;
    occurredAt: ISODateTimeString;
  }): Promise<ParsedWorkoutSession | null>;
  listParsedSessions(filter?: WorkoutSessionFilter): Promise<ParsedWorkoutSession[]>;
  persistIngestionRecord(input: PersistIngestionRecordInput): Promise<void>;
  persistCorrectionRecord(input: PersistCorrectionRecordInput): Promise<void>;
  listCorrectionRecordsBySessionId(
    sessionId: string
  ): Promise<PersistedCorrectionRecord[]>;
}

export class InMemoryWorkoutIngestionRepository
  implements WorkoutIngestionRepository
{
  private readonly responsesByIdempotencyKey = new Map<
    string,
    WorkoutIngestionResponse
  >();

  private readonly persistedRecords: PersistIngestionRecordInput[] = [];
  private readonly correctionRecords: PersistedCorrectionRecord[] = [];

  async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WorkoutIngestionResponse | null> {
    const existing = this.responsesByIdempotencyKey.get(idempotencyKey);
    return existing ? structuredClone(existing) : null;
  }

  async findBySessionId(sessionId: string): Promise<WorkoutIngestionResponse | null> {
    const record = this.persistedRecords.find(
      (candidate) => candidate.response.sessionId === sessionId
    );

    return record ? structuredClone(record.response) : null;
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

  async persistCorrectionRecord(input: PersistCorrectionRecordInput): Promise<void> {
    for (const updatedResponse of input.updatedResponses) {
      const persistedRecord = this.persistedRecords.find(
        (record) => record.response.rawLogId === updatedResponse.rawLogId
      );
      if (!persistedRecord) {
        continue;
      }

      persistedRecord.response = structuredClone(updatedResponse);
      this.responsesByIdempotencyKey.set(
        persistedRecord.idempotencyKey,
        structuredClone(updatedResponse)
      );
    }

    this.correctionRecords.push(structuredClone(input.correction));
  }

  async listCorrectionRecordsBySessionId(
    sessionId: string
  ): Promise<PersistedCorrectionRecord[]> {
    return this.correctionRecords
      .filter((record) => record.sessionId === sessionId)
      .map((record) => structuredClone(record));
  }

  // Verification helper for scripts/tests.
  snapshot(): PersistIngestionRecordInput[] {
    return structuredClone(this.persistedRecords);
  }

  // Verification helper for scripts/tests.
  snapshotCorrections(): PersistedCorrectionRecord[] {
    return structuredClone(this.correctionRecords);
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

  async findBySessionId(sessionId: string): Promise<WorkoutIngestionResponse | null> {
    const result = await this.db.query<RawLogLookupRow>(
      `
      select latest_response
      from workout_raw_logs
      where latest_response->>'sessionId' = $1
      limit 1
      `,
      [sessionId]
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
              computation_version,
              computed_at
            ) values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::jsonb,
              $7,
              $8::timestamptz
            )
            `,
            [
              session.id,
              metrics.totalLbsLifted,
              metrics.totalSets,
              metrics.totalReps,
              metrics.previousSessionTotalLbsDelta ?? null,
              JSON.stringify(metrics.perExerciseProgression),
              metrics.computationVersion ?? 1,
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

  private async replaceSessionProjection(
    response: WorkoutIngestionResponse,
    persistedAt: ISODateTimeString
  ): Promise<void> {
    const session = response.parse.session?.session;
    const exercisePerformances = response.parse.session?.exercisePerformances ?? [];
    const metrics = response.parse.session?.metrics;

    if (!session) {
      return;
    }

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
      on conflict (id) do update set
        raw_log_id = excluded.raw_log_id,
        workout_type_id = excluded.workout_type_id,
        occurred_at = excluded.occurred_at,
        timezone = excluded.timezone,
        parse_version = excluded.parse_version,
        notes = excluded.notes,
        updated_at = excluded.updated_at
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

    await this.db.query(
      `
      delete from exercise_performances
      where session_id = $1
      `,
      [session.id]
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

    if (!metrics) {
      return;
    }

    await this.db.query(
      `
      insert into session_metrics (
        session_id,
        total_lbs_lifted,
        total_sets,
        total_reps,
        previous_session_total_lbs_delta,
        per_exercise_progression,
        computation_version,
        computed_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8::timestamptz
      )
      on conflict (session_id) do update set
        total_lbs_lifted = excluded.total_lbs_lifted,
        total_sets = excluded.total_sets,
        total_reps = excluded.total_reps,
        previous_session_total_lbs_delta = excluded.previous_session_total_lbs_delta,
        per_exercise_progression = excluded.per_exercise_progression,
        computation_version = excluded.computation_version,
        computed_at = excluded.computed_at
      `,
      [
        session.id,
        metrics.totalLbsLifted,
        metrics.totalSets,
        metrics.totalReps,
        metrics.previousSessionTotalLbsDelta ?? null,
        JSON.stringify(metrics.perExerciseProgression),
        metrics.computationVersion ?? 1,
        persistedAt,
      ]
    );
  }

  async persistCorrectionRecord(input: PersistCorrectionRecordInput): Promise<void> {
    await this.db.query("begin");

    try {
      await this.db.query(
        `
        insert into ingestion_corrections (
          id,
          raw_log_id,
          session_id,
          reason,
          patch,
          status,
          requested_at,
          applied_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6,
          $7::timestamptz,
          $8::timestamptz
        )
        `,
        [
          input.correction.correctionId,
          input.correction.rawLogId,
          input.correction.sessionId,
          input.correction.reason,
          JSON.stringify(input.correction.patch),
          input.correction.status,
          input.correction.requestedAt,
          input.correction.appliedAt ?? null,
        ]
      );

      for (const response of input.updatedResponses) {
        await this.db.query(
          `
          update workout_raw_logs
          set
            parse_status = $2,
            overall_confidence = $3,
            latest_response = $4::jsonb,
            updated_at = $5::timestamptz
          where id = $1
          `,
          [
            response.rawLogId,
            response.status,
            response.parse.overallConfidence,
            JSON.stringify(response),
            input.persistedAt,
          ]
        );

        await this.replaceSessionProjection(response, input.persistedAt);
      }

      const correctedResponse = input.updatedResponses.find(
        (response) => response.rawLogId === input.correction.rawLogId
      );

      if (correctedResponse) {
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
            correctedResponse.rawLogId,
            correctedResponse.sessionId ?? null,
            correctedResponse.parseVersion,
            JSON.stringify(correctedResponse.parse.session ?? null),
            JSON.stringify(correctedResponse.parse.fieldConfidence),
            JSON.stringify(correctedResponse.parse.errors),
            JSON.stringify(correctedResponse.parse.warnings),
            input.persistedAt,
          ]
        );
      }

      await this.db.query("commit");
    } catch (error) {
      await this.db.query("rollback");
      throw error;
    }
  }

  async listCorrectionRecordsBySessionId(
    sessionId: string
  ): Promise<PersistedCorrectionRecord[]> {
    const result = await this.db.query<{
      id: string;
      raw_log_id: string;
      session_id: string;
      reason: string;
      patch: WorkoutCorrectionPatch[];
      status: "pending" | "applied" | "rejected";
      requested_at: string;
      applied_at: string | null;
    }>(
      `
      select
        id,
        raw_log_id,
        session_id,
        reason,
        patch,
        status,
        requested_at,
        applied_at
      from ingestion_corrections
      where session_id = $1
      order by requested_at asc, id asc
      `,
      [sessionId]
    );

    return result.rows.map((row) => ({
      correctionId: row.id,
      rawLogId: row.raw_log_id,
      sessionId: row.session_id,
      reason: row.reason,
      patch: row.patch ?? [],
      status: row.status,
      requestedAt: row.requested_at,
      appliedAt: row.applied_at ?? undefined,
    }));
  }
}
