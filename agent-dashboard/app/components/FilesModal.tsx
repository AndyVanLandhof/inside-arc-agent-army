'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { agents } from '@/app/lib/agents';

interface ContextFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  description: string | null;
  created_at: string;
}

interface AttachmentFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  agent_id: string;
  conversation_title: string | null;
  conversation_id: number;
}

interface Props {
  password: string;
  userName: string;
  onClose: () => void;
  onNavigate: (agentId: string, conversationId: number) => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fileIcon(type: string | null): string {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📕';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return '📊';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('text')) return '📄';
  return '📎';
}

export default function FilesModal({ password, userName, onClose, onNavigate }: Props) {
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [tab, setTab] = useState<'context' | 'conversation'>('context');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/files?password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setContextFiles(data.contextFiles || []);
    setAttachments(data.attachments || []);
    setLoading(false);
  }, [password]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    formData.append('uploadedBy', userName);
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setDescription('');
        loadFiles();
      }
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDeleteContext = async (file: ContextFile) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;
    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.id, fileType: 'context', password }),
    });
    loadFiles();
  };

  const handleDeleteAttachment = async (file: AttachmentFile) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;
    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.id, fileType: 'attachment', password }),
    });
    loadFiles();
  };

  const handleGoToConversation = (file: AttachmentFile) => {
    onNavigate(file.agent_id, file.conversation_id);
    onClose();
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : agentId;
  };

  const getAgentIcon = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.icon : '🤖';
  };

  const totalContextSize = contextFiles.reduce((sum, f) => sum + (f.file_size || 0), 0);
  const totalAttachmentSize = attachments.reduce((sum, f) => sum + (f.file_size || 0), 0);

  return (
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-modal files-modal" onClick={e => e.stopPropagation()}>
        <div className="bp-header">
          <div className="bp-title">
            <span>Files</span>
            <span className="bp-subtitle">
              {contextFiles.length + attachments.length} file{contextFiles.length + attachments.length !== 1 ? 's' : ''} | {formatSize(totalContextSize + totalAttachmentSize)} total
            </span>
          </div>
          <div className="bp-actions">
            <button className="bp-close" onClick={onClose}>x</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="files-tabs">
          <button
            className={`files-tab ${tab === 'context' ? 'active' : ''}`}
            onClick={() => setTab('context')}
          >
            Shared Context ({contextFiles.length})
          </button>
          <button
            className={`files-tab ${tab === 'conversation' ? 'active' : ''}`}
            onClick={() => setTab('conversation')}
          >
            Conversation Files ({attachments.length})
          </button>
        </div>

        {loading ? (
          <div className="bp-loading">Loading files...</div>
        ) : tab === 'context' ? (
          <div className="files-context-tab">
            {/* Upload area */}
            <div
              className="files-upload-area"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {uploading ? (
                <div className="files-upload-text">Uploading...</div>
              ) : (
                <div className="files-upload-text">
                  Click or drag a file here to upload shared context for the army
                </div>
              )}
            </div>
            <div className="files-desc-row">
              <input
                className="files-desc-input"
                type="text"
                placeholder="Optional: describe what this file is (e.g. 'Q4 financial projections')"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Context files list */}
            {contextFiles.length === 0 ? (
              <div className="bp-empty" style={{ padding: '2rem 1rem' }}>
                <p>No shared context files yet.</p>
                <p>Upload documents here and every agent will be able to reference them.</p>
              </div>
            ) : (
              <div className="files-list">
                {contextFiles.map(file => (
                  <div key={file.id} className="file-row">
                    <div className="file-icon">{fileIcon(file.file_type)}</div>
                    <div className="file-info">
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-name"
                      >
                        {file.file_name}
                      </a>
                      <div className="file-meta">
                        <span>{formatSize(file.file_size)}</span>
                        <span className="file-dot">·</span>
                        <span>{timeAgo(file.created_at)}</span>
                        {file.uploaded_by && (
                          <>
                            <span className="file-dot">·</span>
                            <span>by {file.uploaded_by}</span>
                          </>
                        )}
                      </div>
                      {file.description && (
                        <div className="file-description">{file.description}</div>
                      )}
                    </div>
                    <button
                      className="file-delete-btn"
                      title="Delete file"
                      onClick={() => handleDeleteContext(file)}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="files-list">
            {attachments.length === 0 ? (
              <div className="bp-empty" style={{ padding: '2rem 1rem' }}>
                <p>No conversation attachments yet.</p>
                <p>Upload files in any conversation using the paperclip icon.</p>
              </div>
            ) : (
              attachments.map(file => (
                <div key={file.id} className="file-row">
                  <div className="file-icon">{fileIcon(file.file_type)}</div>
                  <div className="file-info">
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-name"
                    >
                      {file.file_name}
                    </a>
                    <div className="file-meta">
                      <span>{formatSize(file.file_size)}</span>
                      <span className="file-dot">·</span>
                      <span>{timeAgo(file.created_at)}</span>
                      <span className="file-dot">·</span>
                      <span
                        className="file-agent-link"
                        onClick={() => handleGoToConversation(file)}
                      >
                        {getAgentIcon(file.agent_id)} {getAgentName(file.agent_id)}
                      </span>
                      {file.conversation_title && (
                        <>
                          <span className="file-dot">·</span>
                          <span className="file-conv-title">{file.conversation_title}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="file-delete-btn"
                    title="Delete file"
                    onClick={() => handleDeleteAttachment(file)}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
