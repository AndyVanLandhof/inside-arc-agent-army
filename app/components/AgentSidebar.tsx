'use client';

import { Agent } from '../agents';

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
}

export default function AgentSidebar({ agents, selectedAgent, onSelectAgent }: AgentSidebarProps) {
  return (
    <div className="w-[420px] bg-white border-r border-gray-200 p-4 grid grid-cols-3 gap-3 content-start overflow-y-auto">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={`p-4 border-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center text-center gap-2 min-h-[120px] ${
            agent.id === selectedAgent.id ? agent.activeColor : agent.color
          }`}
        >
          <div className="text-3xl">{agent.icon}</div>
          <div>
            <div className="font-semibold text-sm">{agent.name}</div>
            <div className="text-xs text-gray-600 mt-1">{agent.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
