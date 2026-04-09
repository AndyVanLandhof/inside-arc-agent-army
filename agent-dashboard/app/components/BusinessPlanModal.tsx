'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface Section {
  id: number;
  section_key: string;
  title: string;
  content: string;
  sort_order: number;
  last_updated: string;
  updated_by: string;
}

interface Snapshot {
  id: number;
  changes_summary: string;
  created_at: string;
}

interface Props {
  password: string;
  onClose: () => void;
}

export default function BusinessPlanModal({ password, onClose }: Props) {
  const [sections, setSections] = useState<Section[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    const res = await fetch(`/api/business-plan?password=${encodeURIComponent(password)}`);
    const data = await res.json();
    setSections(data.sections || []);
    setSnapshots(data.snapshots || []);
    setLoading(false);
    if (data.sections?.length > 0 && !activeSection) {
      setActiveSection(data.sections[0].section_key);
    }
  }, [password, activeSection]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleExportMarkdown = () => {
    const md = sections
      .map(s => {
        const date = new Date(s.last_updated).toLocaleDateString('en-GB');
        return `## ${s.title}\n*Last updated: ${date} by ${s.updated_by}*\n\n${s.content}`;
      })
      .join('\n\n---\n\n');

    const header = `# Inside Arc — Living Business Plan\n*Generated: ${new Date().toLocaleDateString('en-GB')}*\n\n---\n\n`;
    const blob = new Blob([header + md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inside-arc-business-plan-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewSnapshot = async (id: number) => {
    const res = await fetch(`/api/business-plan?snapshotId=${id}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    if (data.snapshot) {
      setViewingSnapshot(data.snapshot.full_content);
    }
  };

  const current = sections.find(s => s.section_key === activeSection);

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bp-header">
          <div className="bp-title">
            <span>Inside Arc — Living Business Plan</span>
            <span className="bp-subtitle">
              {sections.length} sections | Last update: {sections.length > 0
                ? timeAgo(sections.reduce((a, b) =>
                    new Date(a.last_updated) > new Date(b.last_updated) ? a : b
                  ).last_updated)
                : 'never'}
            </span>
          </div>
          <div className="bp-actions">
            <button className="bp-btn" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Sections' : 'History'}
            </button>
            <button className="bp-btn" onClick={handleExportMarkdown}>
              Download .md
            </button>
            <button className="bp-close" onClick={onClose}>x</button>
          </div>
        </div>

        {loading ? (
          <div className="bp-loading">Loading business plan...</div>
        ) : sections.length === 0 ? (
          <div className="bp-empty">
            <p>Business plan not yet initialized.</p>
            <p>Ask Millie to set it up, or the system will seed it on first use.</p>
          </div>
        ) : viewingSnapshot ? (
          <div className="bp-snapshot-view">
            <button className="bp-btn" onClick={() => setViewingSnapshot(null)}>Back to current</button>
            <div className="bp-snapshot-content">
              <ReactMarkdown>{viewingSnapshot}</ReactMarkdown>
            </div>
          </div>
        ) : showHistory ? (
          <div className="bp-history">
            <h3>Version History</h3>
            {snapshots.length === 0 ? (
              <p className="bp-empty-text">No snapshots yet.</p>
            ) : (
              <div className="bp-history-list">
                {snapshots.map(snap => (
                  <div key={snap.id} className="bp-history-item" onClick={() => handleViewSnapshot(snap.id)}>
                    <div className="bp-history-date">
                      {new Date(snap.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div className="bp-history-summary">{snap.changes_summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bp-content">
            {/* Section nav */}
            <div className="bp-nav">
              {sections.map(s => (
                <button
                  key={s.section_key}
                  className={`bp-nav-item ${s.section_key === activeSection ? 'active' : ''}`}
                  onClick={() => setActiveSection(s.section_key)}
                >
                  <span className="bp-nav-title">{s.title}</span>
                  <span className="bp-nav-meta">{timeAgo(s.last_updated)}</span>
                </button>
              ))}
            </div>

            {/* Section content */}
            <div className="bp-section">
              {current && (
                <>
                  <div className="bp-section-header">
                    <h2>{current.title}</h2>
                    <span className="bp-section-meta">
                      Updated {new Date(current.last_updated).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })} by {current.updated_by}
                    </span>
                  </div>
                  <div className="bp-section-body">
                    <ReactMarkdown>{current.content}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
