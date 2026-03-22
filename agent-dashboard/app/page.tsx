'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { agents } from '@/app/lib/agents';
import { Agent, Conversation } from '@/app/lib/types';
import AgentSidebar from '@/app/components/AgentSidebar';
import ConversationList from '@/app/components/ConversationList';
import ChatWindow from '@/app/components/ChatWindow';
import SearchOverlay from '@/app/components/SearchOverlay';
import BusinessPlanModal from '@/app/components/BusinessPlanModal';
import FilesModal from '@/app/components/FilesModal';

export default function Home() {
  // ── Auth State ──
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [schemaInitialized, setSchemaInitialized] = useState(false);

  // ── App State ──
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showBusinessPlan, setShowBusinessPlan] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [factCounts, setFactCounts] = useState<Record<string, number>>({});

  // ── Team Request Bar ──
  const [requestInput, setRequestInput] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const skipAutoLoad = useRef(false);

  // ── Team Activity ──
  const [teamActivity, setTeamActivity] = useState<Array<{ user_name: string; last_active: string; last_agent_id: string | null }>>([]);

  // ── Restore session ──
  useEffect(() => {
    const saved = localStorage.getItem('agent_army_session');
    if (saved) {
      const { password: pw, userName: name } = JSON.parse(saved);
      setPassword(pw);
      setUserName(name);
      setIsLoggedIn(true);
    }
  }, []);

  // ── Initialize schema on first login ──
  useEffect(() => {
    if (isLoggedIn && !schemaInitialized) {
      fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }).then(() => setSchemaInitialized(true)).catch(() => {});
    }
  }, [isLoggedIn, schemaInitialized, password]);

  // ── Load conversations when agent changes ──
  const loadConversations = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await fetch(`/api/conversations?agentId=${selectedAgent.id}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    const convs = data.conversations || [];
    setConversations(convs);
    // Auto-select most recent non-archived, or null
    const active = convs.filter((c: Conversation) => !c.archived);
    if (active.length > 0) {
      setSelectedConversation(active[0]);
    } else {
      setSelectedConversation(null);
    }
  }, [isLoggedIn, selectedAgent.id, password]);

  useEffect(() => {
    if (skipAutoLoad.current) {
      skipAutoLoad.current = false;
      return;
    }
    loadConversations();
  }, [loadConversations]);

  // ── Load fact counts for all agents ──
  useEffect(() => {
    if (!isLoggedIn) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const agent of agents) {
        try {
          const res = await fetch(`/api/agent-facts?agentId=${agent.id}&password=${encodeURIComponent(password)}`);
          const data = await res.json();
          counts[agent.id] = (data.facts || []).length;
        } catch {
          counts[agent.id] = 0;
        }
      }
      setFactCounts(counts);
    };
    loadCounts();
  }, [isLoggedIn, password]);

  // ── Load team activity ──
  useEffect(() => {
    if (!isLoggedIn) return;
    const loadActivity = async () => {
      try {
        const res = await fetch(`/api/activity?password=${encodeURIComponent(password)}`);
        const data = await res.json();
        setTeamActivity(data.activity || []);
      } catch {}
    };
    loadActivity();
    const interval = setInterval(loadActivity, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isLoggedIn, password]);

  // ── Toast ──
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Login ──
  const allowedUsers = ['Andy', 'Charlotte', 'Gideon', 'Claudio', 'Aleks', 'Gary', 'Tim', 'Amr'];

  const handleLogin = async () => {
    setLoginError('');
    if (!loginName.trim()) {
      setLoginError('Please enter your name');
      return;
    }
    if (!allowedUsers.some(u => u.toLowerCase() === loginName.trim().toLowerCase())) {
      setLoginError('User not recognised');
      return;
    }
    try {
      // Validate password by calling a simple API
      const res = await fetch(`/api/conversations?agentId=competitive-intel&password=${encodeURIComponent(loginPassword)}`);
      if (res.status === 401) {
        setLoginError('Invalid password');
        return;
      }
      const matchedName = allowedUsers.find(u => u.toLowerCase() === loginName.trim().toLowerCase()) || loginName.trim();
      setPassword(loginPassword);
      setUserName(matchedName);
      setIsLoggedIn(true);
      localStorage.setItem('agent_army_session', JSON.stringify({ password: loginPassword, userName: matchedName }));
      // Track login activity
      fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: matchedName, password: loginPassword }),
      }).catch(() => {});
    } catch {
      setLoginError('Could not connect to server');
    }
  };

  // ── Logout ──
  const handleLogout = () => {
    setIsLoggedIn(false);
    setPassword('');
    setUserName('');
    localStorage.removeItem('agent_army_session');
  };

  // ── New Conversation ──
  const createNewConversation = async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: selectedAgent.id,
        title: 'New conversation',
        createdBy: userName,
        password,
      }),
    });
    const data = await res.json();
    if (data.conversation) {
      await loadConversations();
      setSelectedConversation(data.conversation);
    }
  };

  // ── Delete Conversation ──
  const deleteConversation = async (conv: Conversation) => {
    if (!confirm(`Delete "${conv.title || 'Untitled'}"? This cannot be undone.`)) return;
    await fetch('/api/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id, password }),
    });
    if (selectedConversation?.id === conv.id) {
      setSelectedConversation(null);
    }
    await loadConversations();
  };

  // ── Rename Conversation ──
  const renameConversation = async (conv: Conversation, newTitle: string) => {
    await fetch('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id, title: newTitle, password }),
    });
    await loadConversations();
  };

  // ── Agent Selection ──
  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    // Conversations will reload via useEffect
  };

  // ── Team Request Bar ──
  const handleRouteRequest = async () => {
    if (!requestInput.trim() || isRouting) return;
    const messageText = requestInput;
    setRequestInput('');
    setIsRouting(true);
    try {
      // Step 1: Route to the best agent
      const res = await fetch('/api/route-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, password }),
      });
      const data = await res.json();
      if (!data.agentId) { setIsRouting(false); return; }

      const targetAgent = agents.find(a => a.id === data.agentId);
      if (!targetAgent) { setIsRouting(false); return; }

      showToast(`Routing to ${data.agentName}...`);

      // Step 2: Load conversations for the target agent
      const convRes = await fetch(`/api/conversations?agentId=${data.agentId}&password=${encodeURIComponent(password)}`);
      const convData = await convRes.json();
      const convs = convData.conversations || [];
      const active = convs.filter((c: Conversation) => !c.archived);

      // Step 3: Find or create a conversation
      let conv: Conversation;
      if (active.length > 0) {
        conv = active[0];
      } else {
        const newRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: data.agentId,
            title: messageText.substring(0, 50),
            createdBy: userName,
            password,
          }),
        });
        const newData = await newRes.json();
        conv = newData.conversation;
      }

      // Step 4: Send the message FIRST (so it's saved in DB before UI switches)
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conv.id,
          agentId: data.agentId,
          message: messageText,
          userName,
          password,
        }),
      });

      // Step 5: NOW switch the UI — message and response are already in the DB
      // Skip the auto-load effect so it doesn't race with our manual state set
      skipAutoLoad.current = true;
      setSelectedAgent(targetAgent);

      // Reload conversations to get the latest (including auto-titled)
      const freshRes = await fetch(`/api/conversations?agentId=${data.agentId}&password=${encodeURIComponent(password)}`);
      const freshData = await freshRes.json();
      const freshConvs = freshData.conversations || [];
      setConversations(freshConvs);

      // Find the conversation we sent to (title may have changed from auto-titling)
      const updatedConv = freshConvs.find((c: Conversation) => c.id === conv.id) || conv;
      setSelectedConversation(updatedConv);
      setChatRefreshKey(k => k + 1);
      showToast(`${data.agentName} responded`);
    } catch {
      showToast('Routing failed');
    } finally {
      setIsRouting(false);
    }
  };

  // ── Search Navigation ──
  const handleSearchNavigate = (agentId: string, conversationId: number) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
      // Load conversations and select the right one
      setTimeout(async () => {
        const res = await fetch(`/api/conversations?agentId=${agentId}&password=${encodeURIComponent(password)}`);
        const data = await res.json();
        const convs = data.conversations || [];
        setConversations(convs);
        const target = convs.find((c: Conversation) => c.id === conversationId);
        if (target) setSelectedConversation(target);
      }, 50);
    }
  };

  // ── Login Screen ──
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <h1>Inside Arc Agent Army</h1>
          <p>Sign in to access your AI team</p>
          <div className="login-field">
            <label>Your Name</label>
            <input
              type="text"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter dashboard password"
            />
          </div>
          <button className="login-button" onClick={handleLogin}>
            Sign In
          </button>
          {loginError && <div className="login-error">{loginError}</div>}
          <div className="login-mobile-note">Best experienced on desktop</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <span>🤖</span>
          <span>Inside Arc Agent Army</span>
        </div>

        <div className="header-controls">
          <button className="bp-toggle" onClick={() => setShowBusinessPlan(true)} title="Business Plan">
            Business Plan
          </button>
          <button className="bp-toggle" onClick={() => setShowFiles(true)} title="Files">
            Files
          </button>
          <button className="search-toggle" onClick={() => setShowSearch(true)} title="Search">
            🔍
          </button>
          <div className="team-activity-dots">
            {teamActivity.slice(0, 8).map(u => {
              const mins = Math.floor((Date.now() - new Date(u.last_active).getTime()) / 60000);
              const isOnline = mins < 10;
              const agentObj = u.last_agent_id ? agents.find(a => a.id === u.last_agent_id) : null;
              return (
                <div
                  key={u.user_name}
                  className={`activity-dot ${isOnline ? 'online' : ''}`}
                  title={`${u.user_name}${agentObj ? ` — chatting with ${agentObj.name}` : ''} (${mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins/60)}h ago` : `${Math.floor(mins/1440)}d ago`})`}
                >
                  {u.user_name.charAt(0)}
                </div>
              );
            })}
          </div>
          <div className="user-badge">{userName}</div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Team Request Bar */}
      <div className="request-ribbon">
        <div className="request-bar">
          <input
            value={requestInput}
            onChange={e => setRequestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRouteRequest()}
            placeholder="Ask anything — the right agent will pick it up..."
            disabled={isRouting}
          />
          {isRouting && (
            <div className="routing-indicator">
              <div className="routing-spinner" />
              <span>Routing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="app-container">
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
          factCounts={factCounts}
        />
        <ConversationList
          agent={selectedAgent}
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
        />
        {selectedConversation ? (
          <ChatWindow
            key={`${selectedConversation.id}-${chatRefreshKey}`}
            agent={selectedAgent}
            conversation={selectedConversation}
            password={password}
            userName={userName}
            onToast={showToast}
            onConversationUpdated={loadConversations}
          />
        ) : (
          <div className="chat-window">
            <div className="no-conversation">
              <div className="big-icon">{selectedAgent.icon}</div>
              <p>Select or create a conversation with {selectedAgent.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Overlay */}
      {showSearch && (
        <SearchOverlay
          password={password}
          onClose={() => setShowSearch(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      {/* Business Plan Modal */}
      {showBusinessPlan && (
        <BusinessPlanModal
          password={password}
          onClose={() => setShowBusinessPlan(false)}
        />
      )}

      {/* Files Modal */}
      {showFiles && (
        <FilesModal
          password={password}
          userName={userName}
          onClose={() => setShowFiles(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
