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

// ─── 4. Check Chai Time ──────────────────────────────────
async function checkChaiTime(): Promise<void> {
  const now = new Date();
  const currentMinute = now.getUTCMinutes();

  // Only check at the start of each 10-minute window
  if (currentMinute % 10 !== 0) return;

  // Get all companies with chai_time_config enabled
  const configs = await sql<{
    company_id: string;
    time_hour: number;
    time_minute: number;
    timezone: string;
    last_run_at: string | null;
  }[]>`
    SELECT company_id, time_hour, time_minute, timezone, last_run_at
    FROM chai_time_config
    WHERE enabled = 1`;

  for (const config of configs) {
    // Check if it's the right time in the company's timezone
    const companyTime = new Date(
      now.toLocaleString("en-US", { timeZone: config.timezone || "UTC" })
    );
    const companyHour = companyTime.getHours();
    const companyMinute = companyTime.getMinutes();

    if (companyHour !== config.time_hour || companyMinute >= 10) continue;

    // Check if already run today
    if (config.last_run_at) {
      const lastRun = new Date(config.last_run_at);
      const lastRunLocal = new Date(
        lastRun.toLocaleString("en-US", { timeZone: config.timezone || "UTC" })
      );
      if (
        lastRunLocal.getFullYear() === companyTime.getFullYear() &&
        lastRunLocal.getMonth() === companyTime.getMonth() &&
        lastRunLocal.getDate() === companyTime.getDate()
      ) {
        continue; // Already ran today
      }
    }

    console.log(`[${new Date().toISOString()}] Running Chai Time for company ${config.company_id} (${config.timezone})`);

    try {
      // Get all active agents
      const agents = await sql<{ id: string; role: string; system_prompt: string; company_id: string }[]>`
        SELECT id, role, system_prompt, company_id FROM agents WHERE company_id = ${config.company_id} AND status = 'active'`;

      if (agents.length === 0) {
        console.log(`  Skipped: no active agents`);
        continue;
      }

      const company = await sql<{ name: string }[]>`SELECT name FROM companies WHERE id = ${config.company_id}`;
      const companyName = company[0]?.name ?? "Company";

      // Create session
      const sessionId = crypto.randomUUID();
      await sql`INSERT INTO chai_time_sessions (id, company_id) VALUES (${sessionId}, ${config.company_id})`;

      // Gather context and generate summaries
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const summaries: { agentId: string; role: string; summary: string }[] = [];

      for (const agent of agents) {
        const actions = await sql<{ action_type: string; title: string }[]>`
          SELECT action_type, title FROM agent_actions
          WHERE agent_id = ${agent.id} AND created_at >= ${yesterday.toISOString()}
          ORDER BY created_at DESC LIMIT 20`;

        const tasks = await sql<{ title: string }[]>`
          SELECT title FROM tasks
          WHERE agent_id = ${agent.id} AND status = 'done' AND completed_at >= ${yesterday.toISOString()}`;

        const memory = await sql<{ key: string; value: string }[]>`
          SELECT key, value FROM memory WHERE agent_id = ${agent.id} ORDER BY updated_at DESC LIMIT 10`;

        const actionsText = actions.length > 0
          ? actions.map(a => `- [${a.action_type}] ${a.title}`).join("\n")
          : "No actions logged.";
        const tasksText = tasks.length > 0
          ? tasks.map(t => `- ${t.title} (done)`).join("\n")
          : "No tasks completed.";
        const memoryText = memory.length > 0
          ? memory.slice(0, 10).map(m => `- ${m.key}: ${m.value.slice(0, 200)}`).join("\n")
          : "No memory entries.";

        try {
          const result = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `You are the ${agent.role} Agent for ${companyName}. Here's what you've done in the last 24 hours:\n\nActions:\n${actionsText}\n\nCompleted Tasks:\n${tasksText}\n\nCurrent Memory/Context:\n${memoryText}\n\nWrite a brief standup update (2-3 sentences) covering:\n- What you accomplished\n- Key information other agents should know\n- Any blockers or needs from other agents\n\nBe specific and concise.`,
            }],
          });
          const summary = result.content[0].type === "text" ? result.content[0].text : "No update available.";
          summaries.push({ agentId: agent.id, role: agent.role, summary });
        } catch {
          summaries.push({ agentId: agent.id, role: agent.role, summary: "Unable to generate summary." });
        }
      }

      // Generate cross-updates
      const crossUpdates: { fromRole: string; toRole: string; update: string }[] = [];

      for (const agent of agents) {
        const otherSummaries = summaries
          .filter(s => s.agentId !== agent.id)
          .map(s => `**${s.role}:** ${s.summary}`)
          .join("\n\n");

        if (!otherSummaries) continue;

        try {
          const result = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: `You are the ${agent.role} Agent. Here's what your teammates shared at Chai Time:\n\n${otherSummaries}\n\nBased on these updates, what 1-3 things are most relevant to YOUR role as ${agent.role}?\nHow should this affect your work? Be specific and actionable.\n\nOutput as a JSON array: [{"key": "chai_time_${now.toISOString().slice(0, 10)}_<sourceRole>", "value": "what you learned and how it affects your work"}]\nUse today's date. Only output the JSON array, nothing else.`,
            }],
          });
          const text = result.content[0].type === "text" ? result.content[0].text : "[]";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const updates = JSON.parse(jsonMatch[0]) as { key: string; value: string }[];
            for (const update of updates) {
              const memoryId = crypto.randomUUID();
              await sql`
                INSERT INTO memory (id, agent_id, key, value)
                VALUES (${memoryId}, ${agent.id}, ${update.key}, ${update.value})
                ON CONFLICT (agent_id, key)
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;

              const fromRoleMatch = update.key.match(/chai_time_\d{4}-\d{2}-\d{2}_(.+)$/);
              const fromRole = fromRoleMatch ? fromRoleMatch[1] : "Unknown";
              crossUpdates.push({ fromRole, toRole: agent.role, update: update.value });
            }
          }
        } catch {
          // Non-fatal
        }
      }

      // Log action for each agent
      for (const agent of agents) {
        const actionId = crypto.randomUUID();
        await sql`
          INSERT INTO agent_actions (id, agent_id, action_type, title, detail, source)
          VALUES (${actionId}, ${agent.id}, 'chai_time', 'Chai Time: synced with team',
                  ${`Exchanged context with ${agents.length - 1} other agents`}, 'system')`;
      }

      // Update session
      await sql`
        UPDATE chai_time_sessions
        SET status = 'completed', completed_at = NOW(),
            agent_summaries = ${JSON.stringify(summaries)},
            cross_updates = ${JSON.stringify(crossUpdates)}
        WHERE id = ${sessionId}`;

      // Update last_run_at
      await sql`UPDATE chai_time_config SET last_run_at = NOW() WHERE company_id = ${config.company_id}`;

      console.log(`  ✓ Chai Time completed (${summaries.length} agents, ${crossUpdates.length} cross-updates)`);
    } catch (error) {
      console.error(`  ✗ Chai Time failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ─── 5. Daily Eval Batch ─────────────────────────────────
async function checkDailyEvals(): Promise<void> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Run at midnight UTC (00:00-00:09)
  if (currentHour !== 0 || currentMinute >= 10) return;

  // Get all companies
  const companies = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM companies`;

  for (const company of companies) {
    // Check if we already ran today
    const existing = await sql`
      SELECT id FROM eval_runs
      WHERE company_id = ${company.id}
        AND run_type = 'daily_batch'
        AND started_at >= ${new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()}
      LIMIT 1`;

    if (existing.length > 0) continue;

    console.log(`[${new Date().toISOString()}] Running daily eval batch for ${company.name}`);

    const runId = crypto.randomUUID();
    await sql`INSERT INTO eval_runs (id, company_id, run_type) VALUES (${runId}, ${company.id}, 'daily_batch')`;

    try {
      const agents = await sql<{ id: string; role: string; system_prompt: string }[]>`
        SELECT id, role, system_prompt FROM agents WHERE company_id = ${company.id} AND status = 'active'`;

      const allResults: Record<string, unknown> = {};
      const { defaultTestSuites } = await import("./src/lib/eval-test-suites");

      for (const agent of agents) {
        const roleTests = defaultTestSuites.filter((t: { role: string }) => t.role === agent.role);
        if (roleTests.length === 0) continue;

        // Run 1 random test per agent to keep costs down
        const randomTest = roleTests[Math.floor(Math.random() * roleTests.length)];

        try {
          const agentResponse = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: agent.system_prompt,
            messages: [{ role: "user", content: randomTest.prompt }],
          });
          const responseText = agentResponse.content[0].type === "text" ? agentResponse.content[0].text : "";

          // Judge it
          const judgeResponse = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: `You are an AI quality judge. Score this agent response on 5 dimensions (1-5 each).

Agent Role: ${agent.role}
Company: ${company.name}
User asked: "${randomTest.prompt}"
Agent responded: "${responseText.slice(0, 2000)}"

Score each 1-5:
- relevance: Does it address the question?
- completeness: Is it thorough enough?
- actionability: Can the user act on this?
- role_specificity: Does it sound like a real ${agent.role} expert, not generic AI?
- overall: Overall quality

Output ONLY valid JSON: {"relevance":N,"completeness":N,"actionability":N,"role_specificity":N,"overall":N,"reasoning":"one sentence"}`,
            }],
          });

          const judgeText = judgeResponse.content[0].type === "text" ? judgeResponse.content[0].text : "{}";
          const jsonMatch = judgeText.match(/\{[\s\S]*\}/);
          const scores = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
          const reasoning = scores.reasoning || "";
          delete scores.reasoning;

          const evalId = crypto.randomUUID();
          await sql`
            INSERT INTO agent_evals (id, agent_id, eval_type, scores, judge_reasoning, prompt_used, response_evaluated)
            VALUES (${evalId}, ${agent.id}, 'daily_batch', ${JSON.stringify(scores)}, ${reasoning}, ${randomTest.prompt}, ${responseText.slice(0, 500)})`;

          allResults[agent.role] = { scores, testName: randomTest.name };
          console.log(`  ${agent.role}: ${scores.overall || '?'}/5`);
        } catch (error) {
          console.error(`  ${agent.role}: eval failed — ${error instanceof Error ? error.message : error}`);
          allResults[agent.role] = { error: "eval failed" };
        }
      }

      await sql`
        UPDATE eval_runs
        SET completed_at = NOW(), results = ${JSON.stringify(allResults)}, status = 'completed'
        WHERE id = ${runId}`;

      console.log(`  Done: ${Object.keys(allResults).length} agents evaluated`);
    } catch (error) {
      console.error(`  Eval batch failed: ${error instanceof Error ? error.message : error}`);
      await sql`
        UPDATE eval_runs
        SET completed_at = NOW(), results = ${JSON.stringify({ error: "batch failed" })}, status = 'failed'
        WHERE id = ${runId}`;
    }
  }
}

// ─── Main Loop ───────────────────────────────────────────
async function run() {
  console.log(`[TheAutonomous Worker] Starting...`);
  console.log(`  Database: ${DATABASE_URL!.replace(/:[^@]+@/, ":***@")}`);
  console.log(`  Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`  Features: tasks, cron jobs, daily debriefs, chai time, agent evals`);
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

      // 4. Check Chai Time (every 6th cycle ≈ every minute)
      if (cycleCount % 6 === 0) {
        await checkChaiTime();
      }

      // 5. Check daily evals (every 6th cycle ≈ every minute)
      if (cycleCount % 6 === 0) {
        await checkDailyEvals();
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
