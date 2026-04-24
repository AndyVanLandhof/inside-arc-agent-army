'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Agent } from '../agents';
import { Message, Conversation } from '../lib/types';

interface AttachedDoc {
  fileName: string;
  text: string;
}

interface ChatWindowProps {
  agent: Agent;
  conversation: Conversation | null;
  password: string;
  userName: string;
  onConversationUpdated: () => void;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ChatWindow({ agent, conversation, password, userName, onConversationUpdated }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef(conversation?.id);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isArchived = conversation?.status === 'archived';

  // Load messages when conversation changes
  const loadMessages = useCallback(async () => {
    if (!conversation) {
      setMessages([]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/messages?conversationId=${conversation.id}&password=${encodeURIComponent(password)}`);
      const data = await res.json();
      if (res.ok && conversationIdRef.current === conversation.id) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversation?.id, password]);

  useEffect(() => {
    conversationIdRef.current = conversation?.id;
    loadMessages();
  }, [conversation?.id, loadMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (!conversation) return;

    pollingRef.current = setInterval(async () => {
      if (isLoading) return;

      try {
        const lastMsg = messages[messages.length - 1];
        const afterParam = lastMsg ? `&after=${encodeURIComponent(lastMsg.createdAt)}` : '';
        const res = await fetch(`/api/messages?conversationId=${conversation.id}&password=${encodeURIComponent(password)}${afterParam}`);
        const data = await res.json();
        if (res.ok && data.messages.length > 0 && conversationIdRef.current === conversation.id) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversation?.id, password, messages, isLoading]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let text = '';

      if (ext === 'txt' || ext === 'md') {
        text = await file.text();
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const pageTexts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ');
          pageTexts.push(pageText);
        }
        text = pageTexts.join('\n\n');
        if (!text.trim()) {
          alert(`"${file.name}" appears to be a scanned/image PDF with no embedded text. Please export it as a text-based PDF and try again.`);
          return;
        }
      } else {
        alert('Unsupported file type. Please upload .pdf, .docx, .txt, or .md files.');
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        alert('Could not extract any text from the file.');
        return;
      }

      const MAX_TEXT_LENGTH = 50000;
      const truncated = trimmed.length > MAX_TEXT_LENGTH;
      const finalText = truncated
        ? trimmed.slice(0, MAX_TEXT_LENGTH) + '\n\n[... document truncated at 50,000 characters ...]'
        : trimmed;

      if (truncated) {
        alert(`"${file.name}" was truncated to 50,000 characters to fit the context window.`);
      }

      setAttachedDocs(prev => [...prev, { fileName: file.name, text: finalText }]);
    } catch (err) {
      console.error('File read error:', err);
      alert('Failed to read the file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDoc = (index: number) => {
    setAttachedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !conversation) return;

    const docContext = attachedDocs.length > 0
      ? attachedDocs.map(d => `[Attached Document: ${d.fileName}]\n\n${d.text}`).join('\n\n---\n\n') + '\n\n---\n\n'
      : '';
    const messageText = docContext + input;
    const displayText = input;
    setInput('');
    setAttachedDocs([]);
    setIsLoading(true);

    // Optimistic update — show only the user-typed portion, not the injected doc context
    const optimisticUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: attachedDocs.length > 0
        ? `📎 ${attachedDocs.map(d => d.fileName).join(', ')}\n\n${displayText}`
        : displayText,
      userName: userName,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUserMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          agentId: agent.id,
          conversationId: conversation.id,
          userName,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {
        await loadMessages();
        onConversationUpdated();
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Error: ${data.error}`,
          userName: null,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Network error. Please try again.',
        userName: null,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async () => {
    if (!conversation) return;
    if (window.confirm(`Delete this conversation? This removes all messages and cannot be undone.`)) {
      try {
        await fetch('/api/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.id, password })
        });
        onConversationUpdated();
      } catch {
        alert('Failed to delete conversation');
      }
    }
  };

  const getContributors = () => {
    const userNames = messages
      .filter(m => m.role === 'user' && m.userName)
      .map(m => m.userName!);
    return [...new Set(userNames)];
  };

  const downloadAsMarkdown = () => {
    const contributors = getContributors();
    const header = [
      `# ${agent.name} — ${conversation?.title || 'Chat'}`,
      `**Date:** ${new Date().toLocaleDateString()}`,
      `**Contributors:** ${contributors.length > 0 ? contributors.join(', ') : 'None'}`,
      '',
      '---',
      '',
    ].join('\n');

    const body = messages.map(m => {
      const speaker = m.role === 'user' ? (m.userName || 'User') : agent.name;
      const tag = m.role === 'user' ? `[Question — ${speaker}]` : `[${agent.name}]`;
      return `### ${tag}\n*${new Date(m.createdAt).toLocaleString()}*\n\n${m.content}\n`;
    }).join('\n---\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.id}-${conversation?.id}-chat-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsWord = () => {
    const contributors = getContributors();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${agent.name} - ${conversation?.title || 'Chat'}</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6;">
        <h1>${agent.name}</h1>
        <h2>${conversation?.title || 'Chat'}</h2>
        <p><em>${new Date().toLocaleDateString()}</em></p>
        <p><strong>Contributors:</strong> ${contributors.length > 0 ? contributors.join(', ') : 'None'}</p>
        <hr>
        ${messages.map(m => {
          const speaker = m.role === 'user' ? (m.userName || 'User') : agent.name;
          const label = m.role === 'user' ? `Question — ${speaker}` : agent.name;
          return `
          <div style="margin: 20px 0; padding: 15px; background: ${m.role === 'user' ? '#e3f2fd' : '#f5f5f5'}; border-radius: 8px;">
            <strong>${label}</strong>
            <span style="color: #888; font-size: 12px; margin-left: 8px;">${new Date(m.createdAt).toLocaleString()}</span>
            <p style="white-space: pre-wrap; margin: 10px 0 0 0;">${m.content}</p>
          </div>`;
        }).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.id}-${conversation?.id}-chat-${new Date().toISOString().split('T')[0]}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    const contributors = getContributors();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${agent.name} - ${conversation?.title || 'Chat'}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }
            .message { margin: 20px 0; padding: 15px; border-radius: 8px; page-break-inside: avoid; }
            .user { background: #e3f2fd; }
            .assistant { background: #f5f5f5; }
            .role { font-weight: bold; margin-bottom: 5px; }
            .timestamp { color: #888; font-size: 12px; margin-left: 8px; }
            .content { white-space: pre-wrap; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${agent.name}</h1>
          <h2>${conversation?.title || 'Chat'}</h2>
          <p><em>${new Date().toLocaleDateString()}</em></p>
          <p><strong>Contributors:</strong> ${contributors.length > 0 ? contributors.join(', ') : 'None'}</p>
          <hr>
          ${messages.map(m => {
            const speaker = m.role === 'user' ? (m.userName || 'User') : agent.name;
            const label = m.role === 'user' ? `Question — ${speaker}` : agent.name;
            return `
            <div class="message ${m.role}">
              <span class="role">${label}</span>
              <span class="timestamp">${new Date(m.createdAt).toLocaleString()}</span>
              <div class="content">${m.content}</div>
            </div>`;
          }).join('')}
          <p class="no-print" style="margin-top: 40px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
              Print to PDF
            </button>
          </p>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <span className="text-4xl block mb-3">{agent.icon}</span>
          <h3 className="text-xl font-semibold mb-2">{agent.name}</h3>
          <p className="text-sm">Select or start a conversation to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.icon}</span>
          <div>
            <span className="font-semibold text-lg">{agent.name}</span>
            <span className="text-gray-400 mx-2">&rsaquo;</span>
            <span className="text-gray-600">{conversation.title}</span>
          </div>
          {isArchived && (
            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">Archived</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadAsMarkdown}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Download as Markdown"
          >
            .md
          </button>
          <button
            onClick={downloadAsWord}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Download as Word"
          >
            Word
          </button>
          <button
            onClick={downloadAsPDF}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Print to PDF"
          >
            PDF
          </button>
          <button
            onClick={deleteConversation}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingHistory && (
          <div className="text-center text-gray-400 py-10">
            Loading conversation history...
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            <h3 className="text-xl font-semibold mb-3">Chat with {agent.name}</h3>
            <p className="mb-2">{agent.description}</p>
            <p className="text-sm italic">Start by asking a question related to this agent&apos;s expertise.</p>
            <p className="text-xs text-gray-400 mt-4">Conversations are shared with all team members.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : ''
            }`}>
              {msg.role === 'user' ? getInitials(msg.userName) : <span className="text-xl">{agent.icon}</span>}
            </div>
            <div className={`max-w-[70%] p-4 rounded-xl ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white [&_*]:text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              <div className={`text-xs font-bold mb-1 ${msg.role === 'user' ? 'opacity-80' : 'text-purple-600'}`}>
                {msg.role === 'user' ? (msg.userName || 'User') : agent.name}
              </div>
              <div className="prose prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              <div className={`text-xs mt-2 ${msg.role === 'user' ? 'opacity-50' : 'text-gray-400'}`}>
                {new Date(msg.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl">
              {agent.icon}
            </div>
            <div className="bg-gray-100 p-4 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — hidden for archived conversations */}
      {isArchived ? (
        <div className="p-4 border-t border-gray-200 bg-gray-100 text-center text-gray-500 text-sm">
          This conversation is archived. Start a new conversation to continue chatting.
        </div>
      ) : (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {/* Attached docs */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedDocs.map((doc, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  <span>📎</span>
                  <span className="max-w-[200px] truncate">{doc.fileName}</span>
                  <button
                    onClick={() => removeDoc(i)}
                    className="ml-1 text-purple-500 hover:text-purple-800 font-bold leading-none"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach document (.docx, .txt, .md)"
              className="flex-shrink-0 px-3 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-500 hover:text-gray-700"
            >
              {isUploading ? (
                <span className="text-xs">...</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Ask ${agent.name} anything...`}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg resize-none focus:outline-none focus:border-purple-500"
              rows={3}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
