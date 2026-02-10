import React from 'react';

function AgentSidebar({ agents, selectedAgent, onSelectAgent }) {
  return (
    <div className="agent-sidebar">
      {agents.map(agent => (
        <div
          key={agent.id}
          className={`agent-card ${agent.id === selectedAgent.id ? agent.activeColor : agent.color}`}
          onClick={() => onSelectAgent(agent)}
        >
          <div className="agent-icon">{agent.icon}</div>
          <div className="agent-info">
            <div className="agent-name">{agent.name}</div>
            <div className="agent-description">{agent.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AgentSidebar;
