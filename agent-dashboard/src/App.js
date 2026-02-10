import React, { useState, useEffect } from 'react';
import { agents } from './agents';
import AgentSidebar from './components/AgentSidebar';
import ChatWindow from './components/ChatWindow';
import './App.css';

function App() {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
  const [apiKey, setApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('anthropic_api_key');
    if (saved) {
      setApiKey(saved);
      setShowApiInput(false);
    }
  }, []);

  const handleApiKeySubmit = (key) => {
    localStorage.setItem('anthropic_api_key', key);
    setApiKey(key);
    setShowApiInput(false);
  };

  if (showApiInput) {
    return (
      <div className="api-key-screen">
        <div className="api-key-container">
          <h1>🤖 Inside Arc Agent Army</h1>
          <p>Enter your Anthropic API key to begin</p>
          <input
            type="password"
            placeholder="sk-ant-..."
            className="api-key-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApiKeySubmit(e.target.value);
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.target.previousSibling;
              handleApiKeySubmit(input.value);
            }}
            className="api-key-button"
          >
            Save & Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>Inside Arc Agent Army</h1>
        <button
          onClick={() => setShowApiInput(true)}
          className="settings-button"
        >
          ⚙️ Settings
        </button>
      </header>
      <div className="app-container">
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
        />
        <ChatWindow
          agent={selectedAgent}
          apiKey={apiKey}
        />
      </div>
    </div>
  );
}

export default App;
