/**
 * LessonsHelper implementation — thin wrapper over the `lessons` table.
 *
 * Cross-run learning loop: each agent run writes a structured lesson via
 * helpers.lessons.write({...}); subsequent runs call helpers.lessons.readRecent()
 * in their beforeRun hook so corrections compound over time.
 *
 * Schema in migrations/003_lessons.sql. RLS-scoped per firm.
 *
 * Tests in test/lessons.test.ts mock the postgres client.
 */

import { randomUUID } from "crypto";
import type { LessonRecord, LessonsHelper } from "./agent-sdk-helpers";

export interface LessonsHelperContext {
  /** Active firm. RLS-scoped queries; if RLS isn't yet enforced, this is the WHERE filter. */
  firmId: string;
  /** Active agent. readRecent + write are scoped to this agent within the firm. */
  agentId: string;
}

export function buildLessonsHelper(ctx: LessonsHelperContext): LessonsHelper {
  return {
    async readRecent({ limit = 5 }: { limit?: number } = {}): Promise<LessonRecord[]> {
      const { sql } = await import("./db-postgres");
      if (!sql) {
        // Dev mode without DB: empty list rather than crashing the agent run.
        return [];
      }
      const rows = (await sql`
        SELECT id, company_id, agent_id, run_id, task_description,
               output_accepted, modification_detail, self_critique, created_at
        FROM lessons
        WHERE company_id = ${ctx.firmId}
          AND agent_id = ${ctx.agentId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as Array<{
        id: string;
        agent_id: string;
        run_id: string;
        task_description: string;
        output_accepted: "approved" | "rejected" | "modified" | "unknown";
        modification_detail: string | null;
        self_critique: string | null;
        created_at: Date;
      }>;
      return rows.map((r) => ({
        agentId: r.agent_id,
        runId: r.run_id,
        taskDescription: r.task_description,
        outputAccepted: r.output_accepted,
        modificationDetail: r.modification_detail ?? undefined,
        selfCritique: r.self_critique ?? undefined,
        createdAt: r.created_at,
      }));
    },

    async write(record: Omit<LessonRecord, "createdAt">): Promise<void> {
      const { sql } = await import("./db-postgres");
      if (!sql) {
        // Dev mode: log the lesson so it's not silently dropped.
        console.warn("[lessons] DATABASE_URL missing; lesson not persisted:", {
          agentId: record.agentId,
          runId: record.runId,
        });
        return;
      }
      const id = `lesson_${randomUUID()}`;
      await sql`
        INSERT INTO lessons (
          id, company_id, agent_id, run_id, task_description,
          output_accepted, modification_detail, self_critique
        ) VALUES (
          ${id},
          ${ctx.firmId},
          ${record.agentId},
          ${record.runId},
          ${record.taskDescription},
          ${record.outputAccepted},
          ${record.modificationDetail ?? null},
          ${record.selfCritique ?? null}
        )
      `;
    },
  };
}
