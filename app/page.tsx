'use client';

import { useState, useEffect, useCallback } from 'react';
import { agents } from './agents';
import { Conversation } from './lib/types';
import PasswordGate from './components/PasswordGate';
import AgentSidebar from './components/AgentSidebar';
import ConversationPanel from './components/ConversationPanel';
import ChatWindow from './components/ChatWindow';

export default function Home() {
  const [password, setPassword] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Check for saved session
  useEffect(() => {
    const savedPassword = localStorage.getItem('agent_password');
    const savedName = localStorage.getItem('agent_user_name');
    if (savedPassword && savedName) {
      setPassword(savedPassword);
      setUserName(savedName);
    }
  }, []);

  const handleUnlock = (pwd: string, name: string) => {
    setPassword(pwd);
    setUserName(name);
    localStorage.setItem('agent_password', pwd);
    localStorage.setItem('agent_user_name', name);
  };

  // Load conversations for the selected agent
  const loadConversations = useCallback(async () => {
    if (!password) return;
    setIsLoadingConversations(true);
    try {
      const res = await fetch(`/api/conversations?agentId=${selectedAgent.id}&password=${encodeURIComponent(password)}`);
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations);
        // Auto-select the active conversation, or first in list
        const active = data.conversations.find((c: Conversation) => c.status === 'active');
        if (active) {
          setSelectedConversation(active);
        } else if (data.conversations.length > 0) {
          setSelectedConversation(data.conversations[0]);
        } else {
          setSelectedConversation(null);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [selectedAgent.id, password]);

  useEffect(() => {
    if (password) {
      loadConversations();
    }
  }, [selectedAgent.id, password, loadConversations]);

  const handleNewConversation = async () => {
    if (!password) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent.id, password }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadConversations();
        setSelectedConversation(data.conversation);
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleRenameConversation = async (convId: number, title: string) => {
    if (!password) return;
    try {
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, title, password }),
      });
      await loadConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleConversationUpdated = async () => {
    // Reload conversations (title may have changed, or conversation may have been deleted)
    await loadConversations();
  };

  if (!password || !userName) {
    return (
      <PasswordGate
        onUnlock={handleUnlock}
        savedName={typeof window !== 'undefined' ? localStorage.getItem('agent_user_name') || undefined : undefined}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-16 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Inside Arc Agent Army</h1>
          <span className="text-purple-200 text-sm">Signed in as {userName}</span>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Log out?')) {
              localStorage.removeItem('agent_password');
              setPassword(null);
              setUserName(null);
            }
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
        />
        <ConversationPanel
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          onNewConversation={handleNewConversation}
          onRenameConversation={handleRenameConversation}
          agentName={selectedAgent.name}
          isLoading={isLoadingConversations}
        />
        <ChatWindow
          agent={selectedAgent}
          conversation={selectedConversation}
          password={password}
          userName={userName}
          onConversationUpdated={handleConversationUpdated}
        />
      </div>
    </div>
  );
}
