import { describe, it, expect, beforeEach } from "vitest";
import {
  createCompany,
  getCompany,
  getCompaniesByUser,
  createAgent,
  getAgent,
  getAgentsByCompany,
  createConversation,
  addMessage,
  getMessages,
  setMemory,
  getMemory,
  createTask,
  getTasksByAgent,
  getNextQueuedTask,
  updateTaskStatus,
  requeueFailedTask,
  getActivityFeed,
  upsertSubscription,
  getSubscription,
  checkPlanLimits,
  incrementUsage,
  getUsage,
  createInterAgentMessage,
  completeInterAgentMessage,
} from "@/lib/db";

// Each test gets a fresh user/company context
let userId: string;
let companyId: string;
let agentId: string;

beforeEach(async () => {
  userId = `test-user-${Date.now()}-${Math.random()}`;

  const company = await createCompany({
    name: "Test Corp",
    url: "https://test.com",
    user_id: userId,
    industry: "Tech",
    stage: "startup",
  });
  companyId = company.id;

  const agent = await createAgent({
    company_id: companyId,
    role: "Sales",
    system_prompt: "You are a Sales agent.",
    skills_json: '["Lead scoring"]',
    connectors_json: '["Apollo"]',
  });
  agentId = agent.id;
});

describe("Companies", () => {
  it("creates and retrieves a company", async () => {
    const company = await getCompany(companyId);
    expect(company).toBeDefined();
    expect(company!.name).toBe("Test Corp");
    expect(company!.user_id).toBe(userId);
  });

  it("gets companies by user", async () => {
    const companies = await getCompaniesByUser(userId);
    expect(companies.length).toBeGreaterThanOrEqual(1);
    expect(companies[0].name).toBe("Test Corp");
  });

  it("returns undefined for nonexistent company", async () => {
    expect(await getCompany("nonexistent")).toBeUndefined();
  });
});

describe("Agents", () => {
  it("creates and retrieves an agent", async () => {
    const agent = await getAgent(agentId);
    expect(agent).toBeDefined();
    expect(agent!.role).toBe("Sales");
    expect(agent!.company_id).toBe(companyId);
  });

  it("lists agents by company", async () => {
    const agents = await getAgentsByCompany(companyId);
    expect(agents.length).toBe(1);
    expect(agents[0].role).toBe("Sales");
  });
});

describe("Conversations & Messages", () => {
  it("creates conversation and adds messages", async () => {
    const conv = await createConversation(agentId, "Test chat");
    expect(conv.title).toBe("Test chat");

    await addMessage({ conversation_id: conv.id, role: "user", content: "Hello" });
    await addMessage({
      conversation_id: conv.id,
      role: "assistant",
      content: "Hi there",
    });

    const msgs = await getMessages(conv.id);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
  });

  it("respects message limit", async () => {
    const conv = await createConversation(agentId);
    for (let i = 0; i < 10; i++) {
      await addMessage({
        conversation_id: conv.id,
        role: "user",
        content: `Message ${i}`,
      });
    }
    const msgs = await getMessages(conv.id, 5);
    expect(msgs.length).toBe(5);
  });
});

describe("Memory", () => {
  it("sets and gets memory", async () => {
    await setMemory(agentId, "customer_preference", "Prefers email");
    const memories = await getMemory(agentId);
    expect(memories.length).toBe(1);
    expect(memories[0].key).toBe("customer_preference");
    expect(memories[0].value).toBe("Prefers email");
  });

  it("upserts memory on same key", async () => {
    await setMemory(agentId, "pref", "old value");
    await setMemory(agentId, "pref", "new value");
    const memories = await getMemory(agentId);
    const pref = memories.find((m) => m.key === "pref");
    expect(pref!.value).toBe("new value");
  });
});

describe("Tasks", () => {
  it("creates and retrieves tasks", async () => {
    const task = await createTask({
      agent_id: agentId,
      type: "icp_research",
      title: "Research ICP",
      input_json: "Do the research",
    });
    expect(task.status).toBe("queued");

    const tasks = await getTasksByAgent(agentId);
    expect(tasks.length).toBe(1);
  });

  it("processes task lifecycle: queued → running → done", async () => {
    const task = await createTask({
      agent_id: agentId,
      type: "test",
      title: "Test Task",
    });

    const queued = await getNextQueuedTask();
    expect(queued).toBeDefined();
    // queued task exists (may be from another test's beforeEach or this one)

    await updateTaskStatus(task.id, "running");

    await updateTaskStatus(task.id, "done", {
      result_json: "Task completed successfully",
    });

    const tasks = await getTasksByAgent(agentId);
    expect(tasks[0].status).toBe("done");
    expect(tasks[0].result_json).toBe("Task completed successfully");
  });

  it("handles task failure and requeue", async () => {
    const task = await createTask({
      agent_id: agentId,
      type: "test",
      title: "Failing Task",
    });

    await updateTaskStatus(task.id, "failed", {
      error_message: "API timeout",
    });

    const tasks = await getTasksByAgent(agentId);
    expect(tasks[0].status).toBe("failed");
    expect(tasks[0].error_message).toBe("API timeout");

    await requeueFailedTask(task.id);
    const requeued = await getTasksByAgent(agentId);
    expect(requeued[0].status).toBe("queued");
  });
});

describe("Activity Feed", () => {
  it("shows completed tasks in feed", async () => {
    const task = await createTask({
      agent_id: agentId,
      type: "test",
      title: "Completed Task",
    });
    await updateTaskStatus(task.id, "done", {
      result_json: "Result here",
    });

    const feed = await getActivityFeed(companyId);
    expect(feed.length).toBeGreaterThanOrEqual(1);
    expect(feed[0].title).toBe("Completed Task");
  });
});

describe("Subscriptions & Billing", () => {
  it("creates free subscription by default", async () => {
    const sub = await upsertSubscription(companyId, { plan: "free" });
    expect(sub.plan).toBe("free");
    expect(sub.status).toBe("active");
  });

  it("upgrades subscription", async () => {
    await upsertSubscription(companyId, { plan: "free" });
    await upsertSubscription(companyId, {
      plan: "growth",
      stripe_customer_id: "cus_test123",
    });
    const sub = await getSubscription(companyId);
    expect(sub!.plan).toBe("growth");
    expect(sub!.stripe_customer_id).toBe("cus_test123");
  });

  it("enforces free tier agent limit", async () => {
    await upsertSubscription(companyId, { plan: "free" });
    const limits = await checkPlanLimits(companyId);
    expect(limits.plan).toBe("free");
    expect(limits.agentLimit).toBe(1);
    // Already have 1 agent from beforeEach
    expect(limits.canProvision).toBe(false);
  });

  it("growth tier allows more agents", async () => {
    await upsertSubscription(companyId, { plan: "growth" });
    const limits = await checkPlanLimits(companyId);
    expect(limits.canProvision).toBe(true);
    expect(limits.agentLimit).toBe(5);
  });

  it("tracks usage", async () => {
    await incrementUsage(companyId, "task_count");
    await incrementUsage(companyId, "task_count");
    await incrementUsage(companyId, "message_count");

    const usage = await getUsage(companyId);
    expect(usage.task_count).toBe(2);
    expect(usage.message_count).toBe(1);
  });

  it("enforces free tier task limit", async () => {
    await upsertSubscription(companyId, { plan: "free" });
    // Simulate 100 tasks
    for (let i = 0; i < 100; i++) {
      await incrementUsage(companyId, "task_count");
    }
    const limits = await checkPlanLimits(companyId);
    expect(limits.canCreateTask).toBe(false);
    expect(limits.taskCount).toBe(100);
  });
});

describe("Inter-Agent Messages", () => {
  it("creates and completes relay message", async () => {
    const agent2 = await createAgent({
      company_id: companyId,
      role: "Admin",
      system_prompt: "You are Admin.",
    });

    const msg = await createInterAgentMessage({
      source_agent_id: agentId,
      target_agent_id: agent2.id,
      request: "Draft a contract for Acme",
    });
    expect(msg.status).toBe("pending");

    await completeInterAgentMessage(msg.id, "Here is the draft contract...");

    // Check it appears in activity feed
    const feed = await getActivityFeed(companyId);
    const relayItem = feed.find((f) => f.type === "relay");
    expect(relayItem).toBeDefined();
  });
});
