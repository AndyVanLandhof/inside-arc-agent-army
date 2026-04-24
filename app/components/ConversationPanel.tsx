'use client';

import { useState } from 'react';
import { Conversation } from '../lib/types';

interface ConversationPanelProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: () => void;
  onRenameConversation: (convId: number, title: string) => void;
  agentName: string;
  isLoading: boolean;
}

export default function ConversationPanel({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  agentName,
  isLoading,
}: ConversationPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const activeConversations = conversations.filter(c => c.status === 'active');
  const archivedConversations = conversations.filter(c => c.status === 'archived');

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const submitRename = (convId: number) => {
    if (editTitle.trim()) {
      onRenameConversation(convId, editTitle.trim());
    }
    setEditingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-[240px] bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          {agentName}
        </div>
        <button
          onClick={onNewConversation}
          className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
        >
          + New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="text-center text-gray-400 text-sm py-6">Loading...</div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-6 px-3">
            No conversations yet. Start one above!
          </div>
        )}

        {/* Active conversations */}
        {activeConversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            className={`w-full text-left p-3 border-b border-gray-100 hover:bg-white transition-colors ${
              selectedConversation?.id === conv.id ? 'bg-white border-l-3 border-l-purple-600' : ''
            }`}
          >
            {editingId === conv.id ? (
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => submitRename(conv.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRename(conv.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full text-sm px-1 py-0.5 border border-purple-300 rounded focus:outline-none focus:border-purple-500"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                  <span className="text-sm font-medium text-gray-900 truncate">{conv.title}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{formatDate(conv.updatedAt)}</span>
                  <button
                    onClick={(e) => startRename(conv, e)}
                    className="text-xs text-gray-400 hover:text-purple-600"
                    title="Rename"
                  >
                    edit
                  </button>
                </div>
              </>
            )}
          </button>
        ))}

        {/* Archived section */}
        {archivedConversations.length > 0 && (
          <>
            <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-100">
              Archived
            </div>
            {archivedConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full text-left p-3 border-b border-gray-100 hover:bg-white transition-colors opacity-70 ${
                  selectedConversation?.id === conv.id ? 'bg-white border-l-3 border-l-gray-400 opacity-100' : ''
                }`}
              >
                <div className="text-sm text-gray-600 truncate">{conv.title}</div>
                <div className="text-xs text-gray-400 mt-1">{formatDate(conv.updatedAt)}</div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
