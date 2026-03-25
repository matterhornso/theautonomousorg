/**
 * Database abstraction layer — auto-detects SQLite vs Postgres.
 *
 * When DATABASE_URL is set → uses Postgres (via db-postgres.ts)
 * When DATABASE_URL is NOT set → uses SQLite (via db-sqlite.ts)
 *
 * ALL exported functions are async regardless of backend.
 * Callers must `await` every db call.
 */

import * as sqlite from "./db-sqlite";

const USE_POSTGRES = !!process.env.DATABASE_URL;

// Re-export types
export type {
  UserProfile,
  CreditBalance,
  CreditTransaction,
  AgentAction,
  ApiKey,
  Subscription,
  Task,
  InterAgentMessage,
  ActivityItem,
  MessagingUser,
  TeamMember,
  Debrief,
  FileUpload,
  Webhook,
  UserApiKey,
  ChaiTimeSession,
  ChaiTimeConfig,
  AgentEval,
  EvalTestSuite,
  EvalRun,
  Workflow,
  WorkflowRun,
} from "./db-sqlite";

// Re-export constants
export { CREDITS_PER_PROMPT, SIGNUP_CREDITS } from "./db-sqlite";

// ─── Conditional module loading ──────────────────────────
// Postgres module is lazy-loaded only when DATABASE_URL is set,
// so `better-sqlite3` is not required on Railway and `postgres`
// is not required locally.
let _pg: typeof import("./db-postgres") | null = null;

async function pg(): Promise<typeof import("./db-postgres")> {
  if (!_pg) {
    _pg = await import("./db-postgres");
  }
  return _pg;
}

// ─── Companies ───────────────────────────────────────────
export async function createCompany(data: Parameters<typeof sqlite.createCompany>[0]) {
  if (USE_POSTGRES) return (await pg()).createCompany(data);
  return sqlite.createCompany(data);
}

export async function getCompany(id: string) {
  if (USE_POSTGRES) return (await pg()).getCompany(id);
  return sqlite.getCompany(id);
}

export async function getCompaniesByUser(userId: string) {
  if (USE_POSTGRES) return (await pg()).getCompaniesByUser(userId);
  return sqlite.getCompaniesByUser(userId);
}

export async function claimCompanyForUser(companyId: string, userId: string) {
  if (USE_POSTGRES) return (await pg()).claimCompanyForUser(companyId, userId);
  return sqlite.claimCompanyForUser(companyId, userId);
}

// ─── Agents ──────────────────────────────────────────────
export async function createAgent(data: Parameters<typeof sqlite.createAgent>[0]) {
  if (USE_POSTGRES) return (await pg()).createAgent(data);
  return sqlite.createAgent(data);
}

export async function getAgent(id: string) {
  if (USE_POSTGRES) return (await pg()).getAgent(id);
  return sqlite.getAgent(id);
}

export async function getAgentsByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getAgentsByCompany(companyId);
  return sqlite.getAgentsByCompany(companyId);
}

export async function getAgentRoster(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getAgentRoster(companyId);
  return sqlite.getAgentRoster(companyId);
}

// ─── Conversations ───────────────────────────────────────
export async function createConversation(agentId: string, title?: string) {
  if (USE_POSTGRES) return (await pg()).createConversation(agentId, title);
  return sqlite.createConversation(agentId, title);
}

export async function getConversation(id: string) {
  if (USE_POSTGRES) return (await pg()).getConversation(id);
  return sqlite.getConversation(id);
}

export async function getConversationsByAgent(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getConversationsByAgent(agentId);
  return sqlite.getConversationsByAgent(agentId);
}

// ─── Messages ────────────────────────────────────────────
export async function addMessage(data: Parameters<typeof sqlite.addMessage>[0]) {
  if (USE_POSTGRES) return (await pg()).addMessage(data);
  return sqlite.addMessage(data);
}

export async function getMessages(conversationId: string, limit = 50) {
  if (USE_POSTGRES) return (await pg()).getMessages(conversationId, limit);
  return sqlite.getMessages(conversationId, limit);
}

// ─── Memory ──────────────────────────────────────────────
export async function getMemory(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getMemory(agentId);
  return sqlite.getMemory(agentId);
}

export async function setMemory(agentId: string, key: string, value: string) {
  if (USE_POSTGRES) return (await pg()).setMemory(agentId, key, value);
  return sqlite.setMemory(agentId, key, value);
}

// ─── User Profiles ───────────────────────────────────────
export async function getUserProfile(userId: string) {
  if (USE_POSTGRES) return (await pg()).getUserProfile(userId);
  return sqlite.getUserProfile(userId);
}

export async function upsertUserProfile(userId: string, data: Parameters<typeof sqlite.upsertUserProfile>[1]) {
  if (USE_POSTGRES) return (await pg()).upsertUserProfile(userId, data);
  return sqlite.upsertUserProfile(userId, data);
}

// ─── Credits ─────────────────────────────────────────────
export async function getCredits(userId: string) {
  if (USE_POSTGRES) return (await pg()).getCredits(userId);
  return sqlite.getCredits(userId);
}

export async function hasEnoughCredits(userId: string, cost?: number) {
  if (USE_POSTGRES) return (await pg()).hasEnoughCredits(userId, cost);
  return sqlite.hasEnoughCredits(userId, cost);
}

export async function deductCredits(userId: string, amount: number, description: string) {
  if (USE_POSTGRES) return (await pg()).deductCredits(userId, amount, description);
  return sqlite.deductCredits(userId, amount, description);
}

export async function addCredits(userId: string, amount: number, type: "topup" | "refund", description: string) {
  if (USE_POSTGRES) return (await pg()).addCredits(userId, amount, type, description);
  return sqlite.addCredits(userId, amount, type, description);
}

export async function getCreditTransactions(userId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getCreditTransactions(userId, limit);
  return sqlite.getCreditTransactions(userId, limit);
}

// ─── Agent Actions ───────────────────────────────────────
export async function logAgentAction(data: Parameters<typeof sqlite.logAgentAction>[0]) {
  if (USE_POSTGRES) return (await pg()).logAgentAction(data);
  return sqlite.logAgentAction(data);
}

export async function getAgentActions(agentId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getAgentActions(agentId, limit);
  return sqlite.getAgentActions(agentId, limit);
}

export async function getCompanyActions(companyId: string, limit = 50) {
  if (USE_POSTGRES) return (await pg()).getCompanyActions(companyId, limit);
  return sqlite.getCompanyActions(companyId, limit);
}

// ─── Agent Custom Skills ─────────────────────────────────
export async function getCustomSkills(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getCustomSkills(agentId);
  return sqlite.getCustomSkills(agentId);
}

export async function addCustomSkill(agentId: string, skill: string, addedBy?: string) {
  if (USE_POSTGRES) return (await pg()).addCustomSkill(agentId, skill, addedBy);
  return sqlite.addCustomSkill(agentId, skill, addedBy);
}

export async function removeCustomSkill(agentId: string, skill: string) {
  if (USE_POSTGRES) return (await pg()).removeCustomSkill(agentId, skill);
  return sqlite.removeCustomSkill(agentId, skill);
}

// ─── API Keys ────────────────────────────────────────────
export async function createApiKey(companyId: string, keyHash: string, name: string) {
  if (USE_POSTGRES) return (await pg()).createApiKey(companyId, keyHash, name);
  return sqlite.createApiKey(companyId, keyHash, name);
}

export async function getApiKeyByHash(keyHash: string) {
  if (USE_POSTGRES) return (await pg()).getApiKeyByHash(keyHash);
  return sqlite.getApiKeyByHash(keyHash);
}

export async function getApiKeysByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getApiKeysByCompany(companyId);
  return sqlite.getApiKeysByCompany(companyId);
}

export async function deleteApiKey(id: string) {
  if (USE_POSTGRES) return (await pg()).deleteApiKey(id);
  return sqlite.deleteApiKey(id);
}

// ─── Subscriptions & Billing ─────────────────────────────
export async function getSubscription(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getSubscription(companyId);
  return sqlite.getSubscription(companyId);
}

export async function upsertSubscription(companyId: string, data: Parameters<typeof sqlite.upsertSubscription>[1]) {
  if (USE_POSTGRES) return (await pg()).upsertSubscription(companyId, data);
  return sqlite.upsertSubscription(companyId, data);
}

export async function getUsage(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getUsage(companyId);
  return sqlite.getUsage(companyId);
}

export async function incrementUsage(companyId: string, field: "task_count" | "message_count") {
  if (USE_POSTGRES) return (await pg()).incrementUsage(companyId, field);
  return sqlite.incrementUsage(companyId, field);
}

export async function checkPlanLimits(companyId: string) {
  if (USE_POSTGRES) return (await pg()).checkPlanLimits(companyId);
  return sqlite.checkPlanLimits(companyId);
}

// ─── Tasks ───────────────────────────────────────────────
export async function createTask(data: Parameters<typeof sqlite.createTask>[0]) {
  if (USE_POSTGRES) return (await pg()).createTask(data);
  return sqlite.createTask(data);
}

export async function getTasksByAgent(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getTasksByAgent(agentId);
  return sqlite.getTasksByAgent(agentId);
}

export async function getTasksByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getTasksByCompany(companyId);
  return sqlite.getTasksByCompany(companyId);
}

export async function getNextQueuedTask() {
  if (USE_POSTGRES) return (await pg()).getNextQueuedTask();
  return sqlite.getNextQueuedTask();
}

export async function updateTaskStatus(
  id: string,
  status: "running" | "done" | "failed",
  result?: { result_json?: string; error_message?: string }
) {
  if (USE_POSTGRES) return (await pg()).updateTaskStatus(id, status, result);
  return sqlite.updateTaskStatus(id, status, result);
}

export async function requeueFailedTask(id: string) {
  if (USE_POSTGRES) return (await pg()).requeueFailedTask(id);
  return sqlite.requeueFailedTask(id);
}

// ─── Inter-Agent Messages ────────────────────────────────
export async function createInterAgentMessage(data: Parameters<typeof sqlite.createInterAgentMessage>[0]) {
  if (USE_POSTGRES) return (await pg()).createInterAgentMessage(data);
  return sqlite.createInterAgentMessage(data);
}

export async function completeInterAgentMessage(id: string, response: string) {
  if (USE_POSTGRES) return (await pg()).completeInterAgentMessage(id, response);
  return sqlite.completeInterAgentMessage(id, response);
}

// ─── Activity Feed ───────────────────────────────────────
export async function getActivityFeed(companyId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getActivityFeed(companyId, limit);
  return sqlite.getActivityFeed(companyId, limit);
}

// ─── Messaging Users ────────────────────────────────────
export async function getMessagingUser(platform: string, platformUserId: string) {
  if (USE_POSTGRES) return (await pg()).getMessagingUser(platform, platformUserId);
  return sqlite.getMessagingUser(platform, platformUserId);
}

export async function createMessagingUser(data: Parameters<typeof sqlite.createMessagingUser>[0]) {
  if (USE_POSTGRES) return (await pg()).createMessagingUser(data);
  return sqlite.createMessagingUser(data);
}

export async function updateDefaultAgent(id: string, agentId: string) {
  if (USE_POSTGRES) return (await pg()).updateDefaultAgent(id, agentId);
  return sqlite.updateDefaultAgent(id, agentId);
}

// ─── Scheduled Tasks ─────────────────────────────────────
export async function createScheduledTask(data: Parameters<typeof sqlite.createScheduledTask>[0]) {
  if (USE_POSTGRES) return (await pg()).createScheduledTask(data);
  return sqlite.createScheduledTask(data);
}

export async function getScheduledDueTasks() {
  if (USE_POSTGRES) return (await pg()).getScheduledDueTasks();
  return sqlite.getScheduledDueTasks();
}

export async function getScheduledTasksByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getScheduledTasksByCompany(companyId);
  return sqlite.getScheduledTasksByCompany(companyId);
}

// ─── Team Members ────────────────────────────────────────
export async function createTeamMember(data: Parameters<typeof sqlite.createTeamMember>[0]) {
  if (USE_POSTGRES) return (await pg()).createTeamMember(data);
  return sqlite.createTeamMember(data);
}

export async function getTeamMembers(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getTeamMembers(companyId);
  return sqlite.getTeamMembers(companyId);
}

export async function getTeamMemberByUserId(companyId: string, userId: string) {
  if (USE_POSTGRES) return (await pg()).getTeamMemberByUserId(companyId, userId);
  return sqlite.getTeamMemberByUserId(companyId, userId);
}

export async function acceptInvite(token: string, userId: string) {
  if (USE_POSTGRES) return (await pg()).acceptInvite(token, userId);
  return sqlite.acceptInvite(token, userId);
}

export async function updateTeamMemberRole(id: string, role: string) {
  if (USE_POSTGRES) return (await pg()).updateTeamMemberRole(id, role);
  return sqlite.updateTeamMemberRole(id, role);
}

export async function removeTeamMember(id: string) {
  if (USE_POSTGRES) return (await pg()).removeTeamMember(id);
  return sqlite.removeTeamMember(id);
}

// ─── Agent Assignments ───────────────────────────────────
export async function assignAgent(agentId: string, userId: string, assignedBy?: string) {
  if (USE_POSTGRES) return (await pg()).assignAgent(agentId, userId, assignedBy);
  return sqlite.assignAgent(agentId, userId, assignedBy);
}

export async function unassignAgent(agentId: string, userId: string) {
  if (USE_POSTGRES) return (await pg()).unassignAgent(agentId, userId);
  return sqlite.unassignAgent(agentId, userId);
}

export async function getAgentAssignments(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getAgentAssignments(agentId);
  return sqlite.getAgentAssignments(agentId);
}

export async function getUserAssignedAgents(userId: string, companyId: string) {
  if (USE_POSTGRES) return (await pg()).getUserAssignedAgents(userId, companyId);
  return sqlite.getUserAssignedAgents(userId, companyId);
}

// ─── Debriefs ────────────────────────────────────────────
export async function createDebrief(data: Parameters<typeof sqlite.createDebrief>[0]) {
  if (USE_POSTGRES) return (await pg()).createDebrief(data);
  return sqlite.createDebrief(data);
}

export async function getLatestDebrief(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getLatestDebrief(companyId);
  return sqlite.getLatestDebrief(companyId);
}

export async function getTodaysDebrief(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getTodaysDebrief(companyId);
  return sqlite.getTodaysDebrief(companyId);
}

// ─── File Uploads ────────────────────────────────────────
export async function createFileUpload(data: Parameters<typeof sqlite.createFileUpload>[0]) {
  if (USE_POSTGRES) return (await pg()).createFileUpload(data);
  return sqlite.createFileUpload(data);
}

export async function getFileUpload(id: string) {
  if (USE_POSTGRES) return (await pg()).getFileUpload(id);
  return sqlite.getFileUpload(id);
}

export async function getFilesByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getFilesByCompany(companyId);
  return sqlite.getFilesByCompany(companyId);
}

export async function getFilesByAgent(agentId: string) {
  if (USE_POSTGRES) return (await pg()).getFilesByAgent(agentId);
  return sqlite.getFilesByAgent(agentId);
}

export async function deleteFileUpload(id: string) {
  if (USE_POSTGRES) return (await pg()).deleteFileUpload(id);
  return sqlite.deleteFileUpload(id);
}

export async function getStorageUsageByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getStorageUsageByCompany(companyId);
  return sqlite.getStorageUsageByCompany(companyId);
}

// ─── Webhooks ─────────────────────────────────────────────
export async function createWebhook(data: Parameters<typeof sqlite.createWebhook>[0]) {
  if (USE_POSTGRES) return (await pg()).createWebhook(data);
  return sqlite.createWebhook(data);
}

export async function getWebhook(id: string) {
  if (USE_POSTGRES) return (await pg()).getWebhook(id);
  return sqlite.getWebhook(id);
}

export async function getWebhooksByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getWebhooksByCompany(companyId);
  return sqlite.getWebhooksByCompany(companyId);
}

export async function incrementWebhookTrigger(id: string) {
  if (USE_POSTGRES) return (await pg()).incrementWebhookTrigger(id);
  return sqlite.incrementWebhookTrigger(id);
}

export async function deactivateWebhook(id: string) {
  if (USE_POSTGRES) return (await pg()).deactivateWebhook(id);
  return sqlite.deactivateWebhook(id);
}

// ─── User API Keys (External Service Keys) ──────────────
export async function storeUserApiKey(
  companyId: string,
  serviceName: string,
  displayName: string,
  apiKey: string,
  config?: Record<string, unknown>
) {
  if (USE_POSTGRES) return (await pg()).storeUserApiKey(companyId, serviceName, displayName, apiKey, config);
  return sqlite.storeUserApiKey(companyId, serviceName, displayName, apiKey, config);
}

export async function getUserApiKey(companyId: string, serviceName: string) {
  if (USE_POSTGRES) return (await pg()).getUserApiKey(companyId, serviceName);
  return sqlite.getUserApiKey(companyId, serviceName);
}

export async function getUserApiKeys(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getUserApiKeys(companyId);
  return sqlite.getUserApiKeys(companyId);
}

export async function deleteUserApiKey(companyId: string, serviceName: string) {
  if (USE_POSTGRES) return (await pg()).deleteUserApiKey(companyId, serviceName);
  return sqlite.deleteUserApiKey(companyId, serviceName);
}

export async function updateUserApiKeyLastUsed(companyId: string, serviceName: string) {
  if (USE_POSTGRES) return (await pg()).updateUserApiKeyLastUsed(companyId, serviceName);
  return sqlite.updateUserApiKeyLastUsed(companyId, serviceName);
}

// ─── Batch Queries (for agent status page) ──────────────────
export async function getMemoryByAgentIds(agentIds: string[]) {
  if (USE_POSTGRES) return (await pg()).getMemoryByAgentIds(agentIds);
  return sqlite.getMemoryByAgentIds(agentIds);
}

export async function getCustomSkillsByAgentIds(agentIds: string[]) {
  if (USE_POSTGRES) return (await pg()).getCustomSkillsByAgentIds(agentIds);
  return sqlite.getCustomSkillsByAgentIds(agentIds);
}

export async function getTasksByAgentIds(agentIds: string[]) {
  if (USE_POSTGRES) return (await pg()).getTasksByAgentIds(agentIds);
  return sqlite.getTasksByAgentIds(agentIds);
}

export async function getActionsByAgentIds(agentIds: string[], limit = 10) {
  if (USE_POSTGRES) return (await pg()).getActionsByAgentIds(agentIds, limit);
  return sqlite.getActionsByAgentIds(agentIds, limit);
}

export async function getConversationCountsByAgentIds(agentIds: string[]) {
  if (USE_POSTGRES) return (await pg()).getConversationCountsByAgentIds(agentIds);
  return sqlite.getConversationCountsByAgentIds(agentIds);
}

// ─── Chai Time ───────────────────────────────────────────
export async function getChaiTimeConfig(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getChaiTimeConfig(companyId);
  return sqlite.getChaiTimeConfig(companyId);
}

export async function updateChaiTimeConfig(companyId: string, config: Parameters<typeof sqlite.updateChaiTimeConfig>[1]) {
  if (USE_POSTGRES) return (await pg()).updateChaiTimeConfig(companyId, config);
  return sqlite.updateChaiTimeConfig(companyId, config);
}

export async function createChaiTimeSession(companyId: string) {
  if (USE_POSTGRES) return (await pg()).createChaiTimeSession(companyId);
  return sqlite.createChaiTimeSession(companyId);
}

export async function updateChaiTimeSession(sessionId: string, data: Parameters<typeof sqlite.updateChaiTimeSession>[1]) {
  if (USE_POSTGRES) return (await pg()).updateChaiTimeSession(sessionId, data);
  return sqlite.updateChaiTimeSession(sessionId, data);
}

export async function getLatestChaiTimeSession(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getLatestChaiTimeSession(companyId);
  return sqlite.getLatestChaiTimeSession(companyId);
}

export async function getChaiTimeSessions(companyId: string, limit = 7) {
  if (USE_POSTGRES) return (await pg()).getChaiTimeSessions(companyId, limit);
  return sqlite.getChaiTimeSessions(companyId, limit);
}

// ─── Agent Evals ─────────────────────────────────────────
export async function createEval(data: Parameters<typeof sqlite.createEval>[0]) {
  if (USE_POSTGRES) return (await pg()).createEval(data);
  return sqlite.createEval(data);
}

export async function getEvalsByAgent(agentId: string, limit = 50) {
  if (USE_POSTGRES) return (await pg()).getEvalsByAgent(agentId, limit);
  return sqlite.getEvalsByAgent(agentId, limit);
}

export async function getEvalsByCompany(companyId: string, limit = 100) {
  if (USE_POSTGRES) return (await pg()).getEvalsByCompany(companyId, limit);
  return sqlite.getEvalsByCompany(companyId, limit);
}

export async function getAverageScores(agentId: string, days = 7) {
  if (USE_POSTGRES) return (await pg()).getAverageScores(agentId, days);
  return sqlite.getAverageScores(agentId, days);
}

export async function updateUserFeedback(evalId: string, feedback: string) {
  if (USE_POSTGRES) return (await pg()).updateUserFeedback(evalId, feedback);
  return sqlite.updateUserFeedback(evalId, feedback);
}

export async function getEvalTestSuites(role?: string) {
  if (USE_POSTGRES) return (await pg()).getEvalTestSuites(role);
  return sqlite.getEvalTestSuites(role);
}

export async function createEvalRun(companyId: string, runType: string) {
  if (USE_POSTGRES) return (await pg()).createEvalRun(companyId, runType);
  return sqlite.createEvalRun(companyId, runType);
}

export async function updateEvalRun(runId: string, data: Parameters<typeof sqlite.updateEvalRun>[1]) {
  if (USE_POSTGRES) return (await pg()).updateEvalRun(runId, data);
  return sqlite.updateEvalRun(runId, data);
}

export async function getEvalRuns(companyId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getEvalRuns(companyId, limit);
  return sqlite.getEvalRuns(companyId, limit);
}

export async function getUserFeedbackSummary(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getUserFeedbackSummary(companyId);
  return sqlite.getUserFeedbackSummary(companyId);
}

export async function getFlaggedEvals(companyId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getFlaggedEvals(companyId, limit);
  return sqlite.getFlaggedEvals(companyId, limit);
}

// ─── Workflows ────────────────────────────────────────────
export async function createWorkflow(data: Parameters<typeof sqlite.createWorkflow>[0]) {
  if (USE_POSTGRES) return (await pg()).createWorkflow(data);
  return sqlite.createWorkflow(data);
}

export async function getWorkflowsByCompany(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getWorkflowsByCompany(companyId);
  return sqlite.getWorkflowsByCompany(companyId);
}

export async function getWorkflow(id: string) {
  if (USE_POSTGRES) return (await pg()).getWorkflow(id);
  return sqlite.getWorkflow(id);
}

export async function getActiveWorkflowsByTrigger(companyId: string, triggerAgentRole: string, triggerEvent: string) {
  if (USE_POSTGRES) return (await pg()).getActiveWorkflowsByTrigger(companyId, triggerAgentRole, triggerEvent);
  return sqlite.getActiveWorkflowsByTrigger(companyId, triggerAgentRole, triggerEvent);
}

export async function updateWorkflow(id: string, data: Parameters<typeof sqlite.updateWorkflow>[1]) {
  if (USE_POSTGRES) return (await pg()).updateWorkflow(id, data);
  return sqlite.updateWorkflow(id, data);
}

export async function deleteWorkflow(id: string) {
  if (USE_POSTGRES) return (await pg()).deleteWorkflow(id);
  return sqlite.deleteWorkflow(id);
}

export async function incrementWorkflowTrigger(id: string) {
  if (USE_POSTGRES) return (await pg()).incrementWorkflowTrigger(id);
  return sqlite.incrementWorkflowTrigger(id);
}

export async function createWorkflowRun(data: Parameters<typeof sqlite.createWorkflowRun>[0]) {
  if (USE_POSTGRES) return (await pg()).createWorkflowRun(data);
  return sqlite.createWorkflowRun(data);
}

export async function updateWorkflowRun(id: string, data: Parameters<typeof sqlite.updateWorkflowRun>[1]) {
  if (USE_POSTGRES) return (await pg()).updateWorkflowRun(id, data);
  return sqlite.updateWorkflowRun(id, data);
}

export async function getWorkflowRunsByCompany(companyId: string, limit = 20) {
  if (USE_POSTGRES) return (await pg()).getWorkflowRunsByCompany(companyId, limit);
  return sqlite.getWorkflowRunsByCompany(companyId, limit);
}

// ─── Conversation Search ──────────────────────────────────
export async function searchMessages(companyId: string, query: string, options?: { agentId?: string; limit?: number }) {
  if (USE_POSTGRES) return (await pg()).searchMessages(companyId, query, options);
  return sqlite.searchMessages(companyId, query, options);
}

// ─── Agent Leaderboard ────────────────────────────────────
export async function getAgentLeaderboard(companyId: string) {
  if (USE_POSTGRES) return (await pg()).getAgentLeaderboard(companyId);
  return sqlite.getAgentLeaderboard(companyId);
}

// ─── Postgres Schema Init ────────────────────────────────
// Call this once on deploy to create all tables in Postgres.
export async function initPostgresSchema() {
  if (!USE_POSTGRES) {
    console.log("Not using Postgres — skipping schema init.");
    return;
  }
  const mod = await pg();
  await mod.initSchema();
  console.log("Postgres schema initialized successfully.");
}
