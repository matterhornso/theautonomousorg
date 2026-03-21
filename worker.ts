#!/usr/bin/env node
/**
 * Dedicated Task Worker for TheAutonomous
 *
 * Runs as a standalone process (deploy on Railway/Fly).
 * Polls the tasks table and processes one task at a time.
 * No timeout limits — unlike Vercel's 60s cap.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-ant-... npx tsx worker.ts
 *
 * Deploy on Railway:
 *   1. Create new service in Railway project
 *   2. Set start command: npx tsx worker.ts
 *   3. Add env vars: DATABASE_URL, ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL) || 10000; // 10 seconds
const MAX_RETRIES = 3;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required");
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 20 });
const client = new Anthropic();

interface Task {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  status: string;
  input_json: string | null;
  result_json: string | null;
  retry_count: number;
  error_message: string | null;
}

interface Agent {
  id: string;
  company_id: string;
  role: string;
  system_prompt: string;
}

async function processNextTask(): Promise<boolean> {
  // Grab the next queued task with row-level locking
  const tasks = await sql<Task[]>`
    SELECT * FROM tasks
    WHERE status = 'queued' AND retry_count < ${MAX_RETRIES}
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED`;

  if (tasks.length === 0) return false;

  const task = tasks[0];
  console.log(`[${new Date().toISOString()}] Processing: ${task.title} (${task.id.slice(0, 8)})`);

  // Mark as running
  await sql`UPDATE tasks SET status = 'running' WHERE id = ${task.id}`;

  try {
    // Load the agent
    const agents = await sql<Agent[]>`SELECT * FROM agents WHERE id = ${task.agent_id}`;
    if (agents.length === 0) {
      throw new Error(`Agent ${task.agent_id} not found`);
    }
    const agent = agents[0];

    // Execute via Claude
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: agent.system_prompt,
      messages: [
        {
          role: "user",
          content: `Execute this task:\n\n${task.title}\n\n${task.input_json || ""}`,
        },
      ],
    });

    const resultText = message.content[0].type === "text" ? message.content[0].text : "";

    // Mark as done
    await sql`
      UPDATE tasks
      SET status = 'done', result_json = ${resultText}, completed_at = NOW()
      WHERE id = ${task.id}`;

    // Store as agent memory
    const memoryId = crypto.randomUUID();
    await sql`
      INSERT INTO memory (id, agent_id, key, value)
      VALUES (${memoryId}, ${task.agent_id}, ${"task_" + task.type}, ${`Completed "${task.title}": ${resultText.slice(0, 500)}`})
      ON CONFLICT (agent_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;

    // Track usage
    const month = new Date().toISOString().slice(0, 7);
    const usageId = crypto.randomUUID();
    await sql`
      INSERT INTO usage_records (id, company_id, month, task_count)
      VALUES (${usageId}, ${agent.company_id}, ${month}, 1)
      ON CONFLICT (company_id, month)
      DO UPDATE SET task_count = usage_records.task_count + 1`;

    console.log(`  ✓ Done (${resultText.length} chars)`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`  ✗ Failed: ${errorMsg}`);

    await sql`
      UPDATE tasks
      SET status = 'failed', error_message = ${errorMsg},
          retry_count = retry_count + 1, completed_at = NOW()
      WHERE id = ${task.id}`;

    return true; // true = we processed something, keep checking for more
  }
}

async function run() {
  console.log(`[TheAutonomous Worker] Starting...`);
  console.log(`  Database: ${DATABASE_URL!.replace(/:[^@]+@/, ':***@')}`);
  console.log(`  Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`  Max retries: ${MAX_RETRIES}`);
  console.log("");

  // Process continuously
  while (true) {
    try {
      const processed = await processNextTask();
      if (!processed) {
        // No tasks — wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
      // If we processed a task, immediately check for more (no wait)
    } catch (error) {
      console.error(`[Worker Error] ${error}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Worker] Shutting down...");
  await sql.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Worker] Shutting down...");
  await sql.end();
  process.exit(0);
});

run();
