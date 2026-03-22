'use client';

import { useState } from 'react';
import { Conversation, Agent } from '@/app/lib/types';

interface Props {
  agent: Agent;
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conv: Conversation) => void;
  onRenameConversation?: (conv: Conversation, newTitle: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ConversationList({
  agent,
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const active = conversations.filter(c => !c.archived);
  const archived = conversations.filter(c => c.archived);

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || '');
  };

  const finishEditing = (conv: Conversation) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conv.title && onRenameConversation) {
      onRenameConversation(conv, trimmed);
    }
    setEditingId(null);
  };

  const renderConvItem = (conv: Conversation) => (
    <div
      key={conv.id}
      className={`conv-item ${conv.id === selectedConversation?.id ? 'active' : ''}`}
      onClick={() => onSelectConversation(conv)}
    >
      <div className="conv-item-content">
        {editingId === conv.id ? (
          <input
            className="conv-title-edit"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => finishEditing(conv)}
            onKeyDown={e => {
              if (e.key === 'Enter') finishEditing(conv);
              if (e.key === 'Escape') setEditingId(null);
            }}
            onClick={e => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <div
            className="conv-title"
            onDoubleClick={e => {
              e.stopPropagation();
              startEditing(conv);
            }}
            title="Double-click to rename"
          >
            {conv.title || 'Untitled'}
          </div>
        )}
        <div className="conv-time">{timeAgo(conv.created_at)}</div>
      </div>
      <button
        className="conv-delete-btn"
        title="Delete conversation"
        onClick={e => {
          e.stopPropagation();
          onDeleteConversation(conv);
        }}
      >
        x
      </button>
    </div>
  );

  return (
    <div className="conversation-list">
      <div className="conv-header">
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{agent.icon} Chats</span>
        <button onClick={onNewConversation}>+ New Chat</button>
      </div>
      <div className="conv-items">
        {active.length === 0 && archived.length === 0 && (
          <div className="conv-empty">
            No conversations yet.<br />Click + New Chat to start.
          </div>
        )}

        {active.length > 0 && (
          <>
            <div className="conv-section-title">Active</div>
            {active.map(renderConvItem)}
          </>
        )}

        {archived.length > 0 && (
          <>
            <div className="conv-section-title">Archived</div>
            {archived.map(renderConvItem)}
          </>
        )}
      </div>
    </div>
  );
}
