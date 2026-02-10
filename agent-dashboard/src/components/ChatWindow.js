import React, { useState, useEffect, useRef } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import ReactMarkdown from 'react-markdown';

function ChatWindow({ agent, apiKey }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const clientRef = useRef(null);

  // Initialize Anthropic client
  useEffect(() => {
    if (apiKey) {
      clientRef.current = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Only for demo - should use backend in production
      });
    }
  }, [apiKey]);

  // Load chat history for this agent
  useEffect(() => {
    const savedChats = localStorage.getItem(`chat_history_${agent.id}`);
    if (savedChats) {
      setMessages(JSON.parse(savedChats));
    } else {
      setMessages([]);
    }
  }, [agent.id]);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_history_${agent.id}`, JSON.stringify(messages));
    }
  }, [messages, agent.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await clientRef.current.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: agent.systemPrompt,
        messages: [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content
        }))
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.content[0].text
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Claude API:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}. Please check your API key.`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm(`Clear all chat history with ${agent.name}?`)) {
      setMessages([]);
      localStorage.removeItem(`chat_history_${agent.id}`);
    }
  };

  const exportHistory = () => {
    const markdown = messages.map(m =>
      `**${m.role === 'user' ? 'You' : agent.name}:**\n${m.content}\n`
    ).join('\n---\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.id}-chat-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-agent-info">
          <span className="chat-agent-icon">{agent.icon}</span>
          <span className="chat-agent-name">{agent.name}</span>
        </div>
        <div className="chat-controls">
          <button onClick={exportHistory} className="control-button" title="Export chat">
            📥 Export
          </button>
          <button onClick={clearHistory} className="control-button" title="Clear history">
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h3>👋 Chat with {agent.name}</h3>
            <p>{agent.description}</p>
            <p className="tip">Start by asking a question related to this agent's expertise.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : agent.icon}
            </div>
            <div className="message-content">
              <div className="message-text"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">{agent.icon}</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={`Ask ${agent.name} anything...`}
          className="message-input"
          rows="3"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="send-button"
        >
          {isLoading ? '⏳' : '➤'} Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
