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

beforeEach(() => {
  userId = `test-user-${Date.now()}-${Math.random()}`;

  const company = createCompany({
    name: "Test Corp",
    url: "https://test.com",
    user_id: userId,
    industry: "Tech",
    stage: "startup",
  });
  companyId = company.id;

  const agent = createAgent({
    company_id: companyId,
    role: "Sales",
    system_prompt: "You are a Sales agent.",
    skills_json: '["Lead scoring"]',
    connectors_json: '["Apollo"]',
  });
  agentId = agent.id;
});

describe("Companies", () => {
  it("creates and retrieves a company", () => {
    const company = getCompany(companyId);
    expect(company).toBeDefined();
    expect(company!.name).toBe("Test Corp");
    expect(company!.user_id).toBe(userId);
  });

  it("gets companies by user", () => {
    const companies = getCompaniesByUser(userId);
    expect(companies.length).toBeGreaterThanOrEqual(1);
    expect(companies[0].name).toBe("Test Corp");
  });

  it("returns undefined for nonexistent company", () => {
    expect(getCompany("nonexistent")).toBeUndefined();
  });
});

describe("Agents", () => {
  it("creates and retrieves an agent", () => {
    const agent = getAgent(agentId);
    expect(agent).toBeDefined();
    expect(agent!.role).toBe("Sales");
    expect(agent!.company_id).toBe(companyId);
  });

  it("lists agents by company", () => {
    const agents = getAgentsByCompany(companyId);
    expect(agents.length).toBe(1);
    expect(agents[0].role).toBe("Sales");
  });
});

describe("Conversations & Messages", () => {
  it("creates conversation and adds messages", () => {
    const conv = createConversation(agentId, "Test chat");
    expect(conv.title).toBe("Test chat");

    addMessage({ conversation_id: conv.id, role: "user", content: "Hello" });
    addMessage({
      conversation_id: conv.id,
      role: "assistant",
      content: "Hi there",
    });

    const msgs = getMessages(conv.id);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
  });

  it("respects message limit", () => {
    const conv = createConversation(agentId);
    for (let i = 0; i < 10; i++) {
      addMessage({
        conversation_id: conv.id,
        role: "user",
        content: `Message ${i}`,
      });
    }
    const msgs = getMessages(conv.id, 5);
    expect(msgs.length).toBe(5);
  });
});

describe("Memory", () => {
  it("sets and gets memory", () => {
    setMemory(agentId, "customer_preference", "Prefers email");
    const memories = getMemory(agentId);
    expect(memories.length).toBe(1);
    expect(memories[0].key).toBe("customer_preference");
    expect(memories[0].value).toBe("Prefers email");
  });

  it("upserts memory on same key", () => {
    setMemory(agentId, "pref", "old value");
    setMemory(agentId, "pref", "new value");
    const memories = getMemory(agentId);
    const pref = memories.find((m) => m.key === "pref");
    expect(pref!.value).toBe("new value");
  });
});

describe("Tasks", () => {
  it("creates and retrieves tasks", () => {
    const task = createTask({
      agent_id: agentId,
      type: "icp_research",
      title: "Research ICP",
      input_json: "Do the research",
    });
    expect(task.status).toBe("queued");

    const tasks = getTasksByAgent(agentId);
    expect(tasks.length).toBe(1);
  });

  it("processes task lifecycle: queued → running → done", () => {
    const task = createTask({
      agent_id: agentId,
      type: "test",
      title: "Test Task",
    });

    const queued = getNextQueuedTask();
    expect(queued).toBeDefined();
    // queued task exists (may be from another test's beforeEach or this one)

    updateTaskStatus(task.id, "running");

    updateTaskStatus(task.id, "done", {
      result_json: "Task completed successfully",
    });

    const tasks = getTasksByAgent(agentId);
    expect(tasks[0].status).toBe("done");
    expect(tasks[0].result_json).toBe("Task completed successfully");
  });

  it("handles task failure and requeue", () => {
    const task = createTask({
      agent_id: agentId,
      type: "test",
      title: "Failing Task",
    });

    updateTaskStatus(task.id, "failed", {
      error_message: "API timeout",
    });

    const tasks = getTasksByAgent(agentId);
    expect(tasks[0].status).toBe("failed");
    expect(tasks[0].error_message).toBe("API timeout");

    requeueFailedTask(task.id);
    const requeued = getTasksByAgent(agentId);
    expect(requeued[0].status).toBe("queued");
  });
});

describe("Activity Feed", () => {
  it("shows completed tasks in feed", () => {
    const task = createTask({
      agent_id: agentId,
      type: "test",
      title: "Completed Task",
    });
    updateTaskStatus(task.id, "done", {
      result_json: "Result here",
    });

    const feed = getActivityFeed(companyId);
    expect(feed.length).toBeGreaterThanOrEqual(1);
    expect(feed[0].title).toBe("Completed Task");
  });
});

describe("Subscriptions & Billing", () => {
  it("creates free subscription by default", () => {
    const sub = upsertSubscription(companyId, { plan: "free" });
    expect(sub.plan).toBe("free");
    expect(sub.status).toBe("active");
  });

  it("upgrades subscription", () => {
    upsertSubscription(companyId, { plan: "free" });
    upsertSubscription(companyId, {
      plan: "growth",
      stripe_customer_id: "cus_test123",
    });
    const sub = getSubscription(companyId);
    expect(sub!.plan).toBe("growth");
    expect(sub!.stripe_customer_id).toBe("cus_test123");
  });

  it("enforces free tier agent limit", () => {
    upsertSubscription(companyId, { plan: "free" });
    const limits = checkPlanLimits(companyId);
    expect(limits.plan).toBe("free");
    expect(limits.agentLimit).toBe(1);
    // Already have 1 agent from beforeEach
    expect(limits.canProvision).toBe(false);
  });

  it("growth tier allows more agents", () => {
    upsertSubscription(companyId, { plan: "growth" });
    const limits = checkPlanLimits(companyId);
    expect(limits.canProvision).toBe(true);
    expect(limits.agentLimit).toBe(5);
  });

  it("tracks usage", () => {
    incrementUsage(companyId, "task_count");
    incrementUsage(companyId, "task_count");
    incrementUsage(companyId, "message_count");

    const usage = getUsage(companyId);
    expect(usage.task_count).toBe(2);
    expect(usage.message_count).toBe(1);
  });

  it("enforces free tier task limit", () => {
    upsertSubscription(companyId, { plan: "free" });
    // Simulate 100 tasks
    for (let i = 0; i < 100; i++) {
      incrementUsage(companyId, "task_count");
    }
    const limits = checkPlanLimits(companyId);
    expect(limits.canCreateTask).toBe(false);
    expect(limits.taskCount).toBe(100);
  });
});

describe("Inter-Agent Messages", () => {
  it("creates and completes relay message", () => {
    const agent2 = createAgent({
      company_id: companyId,
      role: "Admin",
      system_prompt: "You are Admin.",
    });

    const msg = createInterAgentMessage({
      source_agent_id: agentId,
      target_agent_id: agent2.id,
      request: "Draft a contract for Acme",
    });
    expect(msg.status).toBe("pending");

    completeInterAgentMessage(msg.id, "Here is the draft contract...");

    // Check it appears in activity feed
    const feed = getActivityFeed(companyId);
    const relayItem = feed.find((f) => f.type === "relay");
    expect(relayItem).toBeDefined();
  });
});
