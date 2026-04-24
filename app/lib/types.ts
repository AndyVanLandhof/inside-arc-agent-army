export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  userName: string | null;
  createdAt: string;
}

export interface Conversation {
  id: number;
  agentId: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
