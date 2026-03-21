export interface Company {
  id: string;
  name: string;
  url: string;
  industry: string | null;
  description: string | null;
  stage: string | null;
  analysis_json: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  company_id: string;
  role: string;
  system_prompt: string;
  company_context: string | null;
  skills_json: string | null;
  connectors_json: string | null;
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface MemoryEntry {
  id: string;
  agent_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  company: {
    name: string;
    industry: string;
    description: string;
    stage: string;
  };
  recommendations: {
    role: string;
    impact: string;
    reason: string;
    example: string;
  }[];
  summary: string;
}
