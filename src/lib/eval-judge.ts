/**
 * Eval Judge Engine — scores agent responses using Claude Haiku as a judge.
 *
 * Two modes:
 * 1. judgeResponse — score a single response (fire-and-forget after chat)
 * 2. runTestSuite — run a full test suite against an agent
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface EvalScores {
  relevance: number;        // 1-5: Does the response address the user's question?
  completeness: number;     // 1-5: Is the response thorough?
  actionability: number;    // 1-5: Can the user act on this immediately?
  role_specificity: number; // 1-5: Does it sound like THIS role, not generic?
  overall: number;          // 1-5: Overall quality
}

export interface JudgeResult {
  scores: EvalScores;
  reasoning: string;
}

export interface TestSuiteResult {
  agentId: string;
  agentRole: string;
  results: {
    testName: string;
    prompt: string;
    response: string;
    scores: EvalScores;
    reasoning: string;
  }[];
  averageScores: EvalScores;
}

/**
 * Score a single response using Claude Haiku as a judge.
 * Designed to run async (fire-and-forget) after each chat response.
 */
export async function judgeResponse(params: {
  agentRole: string;
  companyName: string;
  userMessage: string;
  agentResponse: string;
}): Promise<JudgeResult> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are an AI quality judge. Score this agent response on 5 dimensions (1-5 each).

Agent Role: ${params.agentRole}
Company: ${params.companyName}
User asked: "${params.userMessage.slice(0, 500)}"
Agent responded: "${params.agentResponse.slice(0, 2000)}"

Score each 1-5:
- relevance: Does it address the question?
- completeness: Is it thorough enough?
- actionability: Can the user act on this?
- role_specificity: Does it sound like a real ${params.agentRole} expert, not generic AI?
- overall: Overall quality

Output ONLY valid JSON: {"relevance":N,"completeness":N,"actionability":N,"role_specificity":N,"overall":N,"reasoning":"one sentence"}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    const scores: EvalScores = {
      relevance: clampScore(parsed.relevance),
      completeness: clampScore(parsed.completeness),
      actionability: clampScore(parsed.actionability),
      role_specificity: clampScore(parsed.role_specificity),
      overall: clampScore(parsed.overall),
    };

    return {
      scores,
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch {
    // Fallback: return neutral scores if parsing fails
    return {
      scores: { relevance: 3, completeness: 3, actionability: 3, role_specificity: 3, overall: 3 },
      reasoning: "Unable to parse judge response",
    };
  }
}

/**
 * Run a full test suite against an agent.
 * Sends each test prompt to Claude with the agent's system prompt, then judges the response.
 */
export async function runTestSuite(params: {
  agentId: string;
  agentRole: string;
  companyName: string;
  systemPrompt: string;
  testPrompts: { name: string; prompt: string; expectedQualities: string[] }[];
}): Promise<TestSuiteResult> {
  const results: TestSuiteResult["results"] = [];

  for (const test of params.testPrompts) {
    try {
      // Generate response using the agent's system prompt
      const agentResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: params.systemPrompt,
        messages: [{ role: "user", content: test.prompt }],
      });

      const responseText =
        agentResponse.content[0].type === "text"
          ? agentResponse.content[0].text
          : "";

      // Judge the response
      const judged = await judgeResponse({
        agentRole: params.agentRole,
        companyName: params.companyName,
        userMessage: test.prompt,
        agentResponse: responseText,
      });

      results.push({
        testName: test.name,
        prompt: test.prompt,
        response: responseText.slice(0, 500),
        scores: judged.scores,
        reasoning: judged.reasoning,
      });
    } catch (error) {
      results.push({
        testName: test.name,
        prompt: test.prompt,
        response: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        scores: { relevance: 0, completeness: 0, actionability: 0, role_specificity: 0, overall: 0 },
        reasoning: "Test failed to execute",
      });
    }
  }

  // Calculate average scores
  const validResults = results.filter((r) => r.scores.overall > 0);
  const avg: EvalScores =
    validResults.length > 0
      ? {
          relevance: round(validResults.reduce((s, r) => s + r.scores.relevance, 0) / validResults.length),
          completeness: round(validResults.reduce((s, r) => s + r.scores.completeness, 0) / validResults.length),
          actionability: round(validResults.reduce((s, r) => s + r.scores.actionability, 0) / validResults.length),
          role_specificity: round(validResults.reduce((s, r) => s + r.scores.role_specificity, 0) / validResults.length),
          overall: round(validResults.reduce((s, r) => s + r.scores.overall, 0) / validResults.length),
        }
      : { relevance: 0, completeness: 0, actionability: 0, role_specificity: 0, overall: 0 };

  return {
    agentId: params.agentId,
    agentRole: params.agentRole,
    results,
    averageScores: avg,
  };
}

function clampScore(val: unknown): number {
  const n = Number(val);
  if (isNaN(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function round(val: number): number {
  return Math.round(val * 10) / 10;
}
