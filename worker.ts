#!/usr/bin/env node
/**
 * Dedicated Task Worker for TheAutonomous
 *
 * Runs as a standalone process (deploy on Railway/Fly).
 * Three responsibilities:
 * 1. Process queued tasks (one at a time, no timeout limits)
 * 2. Check and fire scheduled/recurring cron tasks
 * 3. Generate daily debriefs at 10am each user's local time
 *
 * Usage:
 *   DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=sk-ant-... npx tsx worker.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { Cron } from "croner";

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL) || 10000;
const MAX_RETRIES = 3;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required");
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 20 });
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
  cron_expression: string | null;
  is_recurring: number;
  scheduled_at: string | null;
}

interface Agent {
  id: string;
  company_id: string;
  role: string;
  system_prompt: string;
}

// ─── 1. Process Queued Tasks ─────────────────────────────
async function processNextTask(): Promise<boolean> {
  const tasks = await sql<Task[]>`
    SELECT * FROM tasks
    WHERE status = 'queued'
      AND retry_count < ${MAX_RETRIES}
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
      AND (is_recurring = 0 OR is_recurring IS NULL)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED`;

  if (tasks.length === 0) return false;

  const task = tasks[0];
  console.log(`[${new Date().toISOString()}] Processing: ${task.title} (${task.id.slice(0, 8)})`);

  await sql`UPDATE tasks SET status = 'running' WHERE id = ${task.id}`;

  try {
    const agents = await sql<Agent[]>`SELECT * FROM agents WHERE id = ${task.agent_id}`;
    if (agents.length === 0) throw new Error(`Agent ${task.agent_id} not found`);
    const agent = agents[0];

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

    return true;
  }
}

// ─── 2. Check Scheduled/Recurring Tasks ──────────────────
async function checkScheduledTasks(): Promise<void> {
  // Find recurring tasks that are due
  const recurring = await sql<Task[]>`
    SELECT * FROM tasks
    WHERE is_recurring = 1
      AND cron_expression IS NOT NULL
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
      AND status = 'queued'
    LIMIT 5`;

  for (const template of recurring) {
    console.log(`[${new Date().toISOString()}] Cron firing: ${template.title}`);

    // Create a one-time task copy from the recurring template
    const taskId = crypto.randomUUID();
    await sql`
      INSERT INTO tasks (id, agent_id, type, title, input_json, status)
      VALUES (${taskId}, ${template.agent_id}, ${template.type}, ${template.title}, ${template.input_json}, 'queued')`;

    // Calculate next scheduled_at from cron expression
    try {
      const cron = new Cron(template.cron_expression!);
      const nextRun = cron.nextRun();
      if (nextRun) {
        await sql`
          UPDATE tasks
          SET scheduled_at = ${nextRun.toISOString()}
          WHERE id = ${template.id}`;
        console.log(`  Next run: ${nextRun.toISOString()}`);
      } else {
        // No more runs — mark template as done
        await sql`UPDATE tasks SET status = 'done', completed_at = NOW() WHERE id = ${template.id}`;
      }
    } catch {
      console.error(`  ✗ Invalid cron expression: ${template.cron_expression}`);
      await sql`UPDATE tasks SET status = 'failed', error_message = 'Invalid cron expression' WHERE id = ${template.id}`;
    }
  }
}

// ─── 3. Check Daily Debriefs ─────────────────────────────
async function checkDebriefs(): Promise<void> {
  // Find users where:
  // - debrief_enabled = 1
  // - timezone is set
  // - It's currently 10:00-10:09 in their timezone
  // - No debrief generated today for their company
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Only check at the start of each 10-minute window to avoid spamming
  if (currentMinute % 10 !== 0) return;

  // Get all users with debrief enabled
  const users = await sql<{
    user_id: string;
    timezone: string;
    company_id: string;
    company_name: string;
  }[]>`
    SELECT up.user_id, up.timezone, c.id as company_id, c.name as company_name
    FROM user_profiles up
    JOIN companies c ON c.user_id = up.user_id
    WHERE up.debrief_enabled = 1
      AND up.timezone IS NOT NULL`;

  for (const user of users) {
    // Check if it's 10am in the user's timezone
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: user.timezone || "UTC" })
    );
    const userHour = userTime.getHours();
    const userMinute = userTime.getMinutes();

    if (userHour !== 10 || userMinute >= 10) continue;

    // Check if debrief already generated today
    const existing = await sql`
      SELECT id FROM debriefs
      WHERE company_id = ${user.company_id}
        AND created_at >= ${new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()}
      LIMIT 1`;

    if (existing.length > 0) continue;

    console.log(`[${new Date().toISOString()}] Generating debrief for ${user.company_name} (${user.timezone})`);

    try {
      // Get activity from last 24 hours
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const agents = await sql<{ role: string }[]>`
        SELECT role FROM agents WHERE company_id = ${user.company_id} AND status = 'active'`;

      const tasksDone = await sql<{ title: string }[]>`
        SELECT t.title FROM tasks t
        JOIN agents a ON t.agent_id = a.id
        WHERE a.company_id = ${user.company_id}
          AND t.status = 'done'
          AND t.completed_at >= ${yesterday.toISOString()}`;

      const tasksFailed = await sql<{ title: string; error_message: string | null }[]>`
        SELECT t.title, t.error_message FROM tasks t
        JOIN agents a ON t.agent_id = a.id
        WHERE a.company_id = ${user.company_id}
          AND t.status = 'failed'
          AND t.completed_at >= ${yesterday.toISOString()}`;

      const usage = await sql<{ task_count: number; message_count: number }[]>`
        SELECT COALESCE(SUM(task_count), 0) as task_count, COALESCE(SUM(message_count), 0) as message_count
        FROM usage_records
        WHERE company_id = ${user.company_id}
          AND month = ${now.toISOString().slice(0, 7)}`;

      // Generate debrief with Claude Haiku
      const result = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system:
          "You are an executive assistant producing a daily debrief. Be concise, specific, and actionable. Use bullet points.",
        messages: [
          {
            role: "user",
            content: `Daily debrief for ${user.company_name}.

Active agents: ${agents.map((a) => a.role).join(", ") || "None"}
Tasks completed (24h): ${tasksDone.length}
${tasksDone.map((t) => `- ${t.title}`).join("\n") || "None"}
Tasks failed: ${tasksFailed.length}
${tasksFailed.map((t) => `- ${t.title}: ${t.error_message || "unknown"}`).join("\n") || "None"}
Monthly usage: ${usage[0]?.task_count || 0} tasks, ${usage[0]?.message_count || 0} messages

Format as:
## Daily Debrief — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

### What Happened
### Attention Needed
### Recommendations
### Metrics`,
          },
        ],
      });

      const content = result.content[0].type === "text" ? result.content[0].text : "Debrief failed.";

      // Save debrief
      const debriefId = crypto.randomUUID();
      await sql`
        INSERT INTO debriefs (id, company_id, user_id, content, period_start, period_end, delivered_via)
        VALUES (${debriefId}, ${user.company_id}, ${user.user_id}, ${content},
                ${yesterday.toISOString()}, ${now.toISOString()}, 'dashboard')`;

      console.log(`  ✓ Debrief generated (${content.length} chars)`);
    } catch (error) {
      console.error(`  ✗ Debrief failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ─── Main Loop ───────────────────────────────────────────
async function run() {
  console.log(`[TheAutonomous Worker] Starting...`);
  console.log(`  Database: ${DATABASE_URL!.replace(/:[^@]+@/, ":***@")}`);
  console.log(`  Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`  Features: tasks, cron jobs, daily debriefs`);
  console.log("");

  let cycleCount = 0;

  while (true) {
    try {
      // 1. Process queued tasks
      const processed = await processNextTask();

      // 2. Check cron jobs (every cycle)
      await checkScheduledTasks();

      // 3. Check debriefs (every 6th cycle ≈ every minute)
      if (cycleCount % 6 === 0) {
        await checkDebriefs();
      }

      cycleCount++;

      if (!processed) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
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
