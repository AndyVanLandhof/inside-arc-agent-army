'use client';

import { Agent, AgentFact } from '@/app/lib/types';

interface Props {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
  factCounts: Record<string, number>;
}

export default function AgentSidebar({ agents, selectedAgent, onSelectAgent, factCounts }: Props) {
  return (
    <div className="agent-grid">
      <div className="agent-grid-title">Agents</div>
      <div className="agent-grid-list">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`agent-card ${agent.id === selectedAgent?.id ? 'active' : ''}`}
            style={{
              background: agent.id === selectedAgent?.id ? agent.activeColor : agent.color,
              borderColor: agent.id === selectedAgent?.id ? '#667eea' : '#e0e0e0',
            }}
            onClick={() => onSelectAgent(agent)}
          >
            <div className="agent-icon">{agent.icon}</div>
            <div className="agent-info">
              <div className="agent-name">{agent.name}</div>
              <div className="agent-desc">{agent.description}</div>
              {(factCounts[agent.id] || 0) > 0 && (
                <div className="fact-count">🧠 {factCounts[agent.id]} memories</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
