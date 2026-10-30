import React, { useState } from 'react';

export default function MindMapCanvas({ data, onNodeClick }) {
  const [selectedNode, setSelectedNode] = useState(null);

  if (!data) {
    return <div style={{ padding: 20, color: 'var(--text-muted)' }}>No mind map data loaded.</div>;
  }

  // Render tree recursively
  const renderTree = (node, depth = 0) => {
    if (!node) return null;
    return (
      <div key={node.id} style={{ marginLeft: depth * 24, marginTop: 8 }}>
        <div
          onClick={() => {
            setSelectedNode(node);
            if (onNodeClick) onNodeClick(node);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderRadius: 12,
            background: depth === 0 ? 'var(--gradient-brand)' : depth === 1 ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
            color: depth === 0 ? '#fff' : 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            fontWeight: depth === 0 ? 700 : 500,
            fontSize: depth === 0 ? 16 : 14,
            boxShadow: depth === 0 ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <i className={depth === 0 ? "fa-solid fa-brain" : depth === 1 ? "fa-solid fa-diagram-project" : "fa-solid fa-circle-dot"} />
          <span>{node.name}</span>
          {node.children && node.children.length > 0 && (
            <span style={{ fontSize: 11, opacity: 0.8, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 10 }}>
              {node.children.length}
            </span>
          )}
        </div>

        {node.children && node.children.length > 0 && (
          <div style={{ borderLeft: '2px dashed var(--accent-primary)', marginLeft: 16, paddingLeft: 12, marginTop: 4 }}>
            {node.children.map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ padding: 16, overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
        {renderTree(data)}
      </div>

      {/* Node Details Modal */}
      {selectedNode && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div className="glass-card" style={{ maxWidth: 500, width: '100%', margin: 0, position: 'relative' }}>
            <button
              onClick={() => setSelectedNode(null)}
              className="icon-btn"
              style={{ position: 'absolute', top: 16, right: 16 }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h3 style={{ fontSize: 20, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-node-js" style={{ color: 'var(--accent-primary)' }}></i>
              {selectedNode.name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
              Interactive concept node in Vidya AI visual learning tree.
            </p>
            <div style={{ background: 'var(--bg-tertiary)', padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
              <strong>AI Key Takeaway:</strong> Master this sub-concept to solve high-yield examination numericals.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => alert(`Saved ${selectedNode.name} concept notes to library!`)}>
                <i className="fa-solid fa-bookmark"></i> Save to Notes
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => alert(`Generated 5 practice questions for ${selectedNode.name}`)}>
                <i className="fa-solid fa-vial"></i> Practice Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
