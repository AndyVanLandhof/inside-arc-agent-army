export interface Agent {
  id: string;
  name: string;
  icon: string;
  color: string;
  activeColor: string;
  description: string;
  systemPrompt: string;
}

export interface Conversation {
  id: number;
  agent_id: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
  archived: boolean;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  user_name: string | null;
  pinned: boolean;
  created_at: string;
}

export interface AgentFact {
  id: number;
  agent_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface Attachment {
  id: number;
  message_id: number | null;
  conversation_id: number;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface SearchResult {
  messageId: number;
  agentId: string;
  agentName: string;
  conversationId: number;
  conversationTitle: string;
  content: string;
  userName: string | null;
  role: string;
  createdAt: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface AgentView {
  id: number;
  agent_id: string;
  content: string;
  generated_by: string;
  generated_at: string;
}

export interface PendingAttachment {
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}
