'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Agent, Message, AgentFact, AgentView, Conversation, PendingAttachment, Attachment } from '@/app/lib/types';
import { agents } from '@/app/lib/agents';

interface Props {
  agent: Agent;
  conversation: Conversation;
  password: string;
  userName: string;
  onToast: (msg: string) => void;
  onConversationUpdated?: () => void;
}

interface MessageWithMeta extends Message {
  toolsUsed?: string[];
  attachments?: Attachment[];
}

export default function ChatWindow({ agent, conversation, password, userName, onToast, onConversationUpdated }: Props) {
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [facts, setFacts] = useState<AgentFact[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinned, setShowPinned] = useState(true);
  const [shareOpenId, setShareOpenId] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showLatestView, setShowLatestView] = useState(false);
  const [latestView, setLatestView] = useState<AgentView | null>(null);
  const [isGeneratingView, setIsGeneratingView] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages
  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?conversationId=${conversation.id}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }, [conversation.id, password]);

  // Load facts
  const loadFacts = useCallback(async () => {
    const res = await fetch(`/api/agent-facts?agentId=${agent.id}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setFacts(data.facts || []);
  }, [agent.id, password]);

  // Load pinned
  const loadPinned = useCallback(async () => {
    const res = await fetch(`/api/messages?conversationId=${conversation.id}&pinnedOnly=true&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setPinnedMessages(data.messages || []);
  }, [conversation.id, password]);

  // Load attachments
  const loadAttachments = useCallback(async () => {
    // Attachments are loaded with messages context — we use a simple approach
    // just loading all for the conversation
  }, []);

  useEffect(() => {
    loadMessages();
    loadFacts();
    loadPinned();
    setPendingFiles([]);
    setInput('');
  }, [conversation.id, agent.id, loadMessages, loadFacts, loadPinned]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send Message ──
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Upload pending files first
    for (const pf of pendingFiles) {
      const formData = new FormData();
      formData.append('file', pf.file);
      formData.append('conversationId', String(conversation.id));
      formData.append('password', password);
      try {
        await fetch('/api/upload', { method: 'PUT', body: formData });
      } catch {
        onToast(`Failed to upload ${pf.name}`);
      }
    }
    setPendingFiles([]);

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, {
      id: Date.now(),
      conversation_id: conversation.id,
      role: 'user' as const,
      content: userMsg,
      user_name: userName,
      pinned: false,
      created_at: new Date().toISOString(),
    }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          agentId: agent.id,
          message: userMsg,
          userName,
          password,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If conversation was auto-titled, refresh the conversation list
      if (data.newTitle && onConversationUpdated) {
        onConversationUpdated();
      }

      // Reload messages to get the DB-persisted versions with IDs
      await loadMessages();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        conversation_id: conversation.id,
        role: 'assistant' as const,
        content: `Error: ${errMsg}`,
        user_name: null,
        pinned: false,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pin Toggle ──
  const togglePin = async (msg: MessageWithMeta) => {
    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id, pinned: !msg.pinned, password }),
    });
    await loadMessages();
    await loadPinned();
  };

  // ── Add Fact ──
  const addFact = async (content: string) => {
    if (!content.trim()) return;
    await fetch('/api/agent-facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, content, createdBy: userName, password }),
    });
    setNewFact('');
    await loadFacts();
    onToast('Memory saved');
  };

  // ── Delete Fact ──
  const deleteFact = async (factId: number) => {
    await fetch('/api/agent-facts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factId, password }),
    });
    await loadFacts();
  };

  // ── Remember This (extract from assistant message) ──
  const rememberMessage = async (content: string) => {
    // Extract first meaningful sentence
    const firstLine = content.split('\n').find(l => l.trim().length > 10)?.trim() || content.substring(0, 200);
    await addFact(firstLine);
  };

  // ── Share to Agent ──
  const shareToAgent = async (targetAgentId: string, content: string) => {
    setShareOpenId(null);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAgentId: agent.id,
          targetAgentId,
          content,
          password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Shared to ${data.targetAgentName}`);
      }
    } catch {
      onToast('Failed to share');
    }
  };

  // ── File Handling ──
  const handleFiles = (fileList: FileList) => {
    const newFiles: PendingAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) {
        onToast(`${file.name} is too large (max 10MB)`);
        continue;
      }
      newFiles.push({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // ── Export ──
  const exportChat = () => {
    const md = messages.map(m =>
      `**${m.role === 'user' ? (m.user_name || 'User') : agent.name}:**\n${m.content}\n`
    ).join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.id}-${conversation.id}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Latest View ──
  const openLatestView = async () => {
    setShowLatestView(true);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/agent-view?agentId=${agent.id}&password=${encodeURIComponent(password)}`);
      const data = await res.json();
      setLatestView(data.view || null);
    } catch {
      setLatestView(null);
    } finally {
      setViewLoading(false);
    }
  };

  const generateView = async () => {
    setIsGeneratingView(true);
    try {
      const res = await fetch('/api/agent-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, userName, password }),
      });
      const data = await res.json();
      if (data.error) {
        onToast(data.error);
      } else {
        setLatestView(data.view);
        onToast('Latest View generated');
      }
    } catch {
      onToast('Failed to generate view');
    } finally {
      setIsGeneratingView(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const otherAgents = agents.filter(a => a.id !== agent.id);

  return (
    <div
      className={`chat-window ${isDragOver ? 'drop-zone-active' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-top">
          <div className="chat-agent-info">
            <span>{agent.icon}</span>
            <span>{agent.name}</span>
            <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
              {'>'} {conversation.title || 'Untitled'}
            </span>
          </div>
          <div className="chat-controls">
            <button className="control-btn" onClick={openLatestView}>Latest View</button>
            <button className="control-btn" onClick={exportChat}>Export</button>
          </div>
        </div>

        {/* Memory Panel */}
        <div className="memory-panel">
          <button className="memory-toggle" onClick={() => setShowMemory(!showMemory)}>
            <span>🧠 Memory ({facts.length} facts)</span>
            <span>{showMemory ? '▾' : '▸'}</span>
          </button>
          {showMemory && (
            <div className="memory-content">
              {facts.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: '#999', padding: '0.3rem 0' }}>
                  No memories yet. Add facts the agent should always remember.
                </div>
              )}
              {facts.map(f => (
                <div key={f.id} className="memory-fact">
                  <span className="fact-text">{f.content}</span>
                  <button className="fact-delete" onClick={() => deleteFact(f.id)}>x</button>
                </div>
              ))}
              <div className="memory-add">
                <input
                  value={newFact}
                  onChange={e => setNewFact(e.target.value)}
                  placeholder="Add a fact..."
                  onKeyDown={e => e.key === 'Enter' && addFact(newFact)}
                />
                <button onClick={() => addFact(newFact)}>Add</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <div className="pinned-section">
          <button className="pinned-toggle" onClick={() => setShowPinned(!showPinned)}>
            <span>📌</span>
            <span>Pinned ({pinnedMessages.length})</span>
            <span style={{ marginLeft: 'auto' }}>{showPinned ? '▾' : '▸'}</span>
          </button>
          {showPinned && (
            <div className="pinned-messages">
              {pinnedMessages.map(pm => (
                <div key={pm.id} className="pinned-msg">
                  {pm.content.substring(0, 150)}
                  {pm.content.length > 150 ? '...' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 && !isLoading && (
          <div className="welcome-message">
            <h3>Chat with {agent.name}</h3>
            <p>{agent.description}</p>
            <div className="onboarding-tips">
              <div className="tip-item"><span className="tip-icon">💡</span> <strong>Request Bar</strong> — Type any question in the bar above and it auto-routes to the best agent</div>
              <div className="tip-item"><span className="tip-icon">🧠</span> <strong>Memory</strong> — Pin key facts so the agent remembers them across all conversations</div>
              <div className="tip-item"><span className="tip-icon">📊</span> <strong>Latest View</strong> — One-click summary of everything discussed with this agent</div>
              <div className="tip-item"><span className="tip-icon">📤</span> <strong>Share</strong> — Send any response to another agent as a brief</div>
              <div className="tip-item"><span className="tip-icon">📎</span> <strong>Files</strong> — Upload documents for analysis, or add shared context for all agents</div>
              <div className="tip-item"><span className="tip-icon">📌</span> <strong>Pin</strong> — Star important messages so key decisions don{"'"}t get lost</div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${msg.role} ${msg.pinned ? 'pinned-highlight' : ''}`}
          >
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : agent.icon}
            </div>
            <div className="message-content">
              <div className="message-text">
                <ReactMarkdown
                  components={{
                    img: ({ src, alt }) => (
                      <img
                        src={typeof src === 'string' ? src : undefined}
                        alt={alt || 'Generated image'}
                        onClick={(e) => { e.stopPropagation(); if (typeof src === 'string') setLightboxUrl(src); }}
                        title="Click to expand"
                      />
                    ),
                  }}
                >{msg.content}</ReactMarkdown>
              </div>

              {/* Tool badges */}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="tools-used">
                  {msg.toolsUsed.map(t => (
                    <span key={t} className="tool-badge">🔧 {t}</span>
                  ))}
                </div>
              )}

              {/* Message Actions */}
              <div className="message-actions">
                <button
                  className={`msg-action-btn ${msg.pinned ? 'pinned' : ''}`}
                  onClick={() => togglePin(msg)}
                >
                  📌 {msg.pinned ? 'Unpin' : 'Pin'}
                </button>

                {msg.role === 'assistant' && (
                  <>
                    <button
                      className="msg-action-btn"
                      onClick={() => rememberMessage(msg.content)}
                    >
                      🧠 Remember
                    </button>
                    <button
                      className="msg-action-btn"
                      onClick={() => setShareOpenId(shareOpenId === msg.id ? null : msg.id)}
                    >
                      📤 Share
                    </button>
                  </>
                )}
              </div>

              {/* Share Dropdown */}
              {shareOpenId === msg.id && (
                <div className="share-dropdown">
                  {otherAgents.map(a => (
                    <button
                      key={a.id}
                      className="share-dropdown-item"
                      onClick={() => shareToAgent(a.id, msg.content)}
                    >
                      <span>{a.icon}</span>
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
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

      {/* Input Area */}
      <div className="input-area">
        {/* File Chips */}
        {pendingFiles.length > 0 && (
          <div className="file-chips">
            {pendingFiles.map((f, i) => (
              <div key={i} className="file-chip">
                {f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📎'}
                <span>{f.name}</span>
                <span className="file-size">({formatSize(f.size)})</span>
                <button
                  className="file-remove"
                  onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="input-row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
            accept="image/*,.pdf,.txt,.md,.csv,.json"
          />
          <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach files">
            📎
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Ask ${agent.name}...`}
            className="message-input"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div className="image-lightbox" onClick={() => setLightboxUrl(null)}>
          <div className="image-lightbox-actions">
            <button onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = lightboxUrl;
              a.download = `generated-image-${Date.now()}.png`;
              a.target = '_blank';
              a.click();
            }}>
              Download
            </button>
            <button onClick={() => setLightboxUrl(null)}>Close</button>
          </div>
          <img
            src={lightboxUrl}
            alt="Generated image"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Latest View Modal */}
      {showLatestView && (
        <div className="lv-overlay" onClick={() => setShowLatestView(false)}>
          <div className="lv-modal" onClick={e => e.stopPropagation()}>
            <div className="lv-header">
              <div className="lv-title">
                <span>{agent.icon} {agent.name} — Latest View</span>
                {latestView && (
                  <span className="lv-meta">
                    Generated {new Date(latestView.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {latestView.generated_by ? ` by ${latestView.generated_by}` : ''}
                  </span>
                )}
              </div>
              <div className="lv-actions">
                <button
                  className="lv-refresh-btn"
                  onClick={generateView}
                  disabled={isGeneratingView}
                >
                  {isGeneratingView ? 'Generating...' : latestView ? 'Refresh' : 'Generate'}
                </button>
                <button className="bp-close" onClick={() => setShowLatestView(false)}>x</button>
              </div>
            </div>
            <div className="lv-body">
              {viewLoading ? (
                <div className="lv-loading">Loading...</div>
              ) : isGeneratingView ? (
                <div className="lv-loading">
                  <div className="routing-spinner" style={{ width: 24, height: 24 }} />
                  <span>Synthesising all conversations...</span>
                </div>
              ) : latestView ? (
                <div className="lv-content">
                  <ReactMarkdown>{latestView.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="lv-empty">
                  <p>No Latest View generated yet.</p>
                  <p>Click <strong>Generate</strong> to synthesise all conversations with {agent.name} into a curated summary of the current state of play.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
