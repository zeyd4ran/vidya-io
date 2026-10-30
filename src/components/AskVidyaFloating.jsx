import React, { useState } from 'react';

export default function AskVidyaFloating({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('INTERMEDIATE MODE');
  const [chat, setChat] = useState([
    { sender: 'vidya', text: 'Hello! I am Vidya 🤖, your 24/7 AI Tutor. Ask me any doubt, concept explanation, or problem solving hint!' }
  ]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg = prompt;
    setPrompt('');
    setChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/doubt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vidya_token') || ''}`
        },
        body: JSON.stringify({
          prompt: userMsg,
          mode,
          subject: 'Physics',
          topic: 'Electrostatics'
        })
      });
      const data = await res.json();
      const solution = data.solution || {};

      let responseText = solution.summary || 'Solution generated successfully!';
      if (solution.final_answer) {
        responseText += `\n\n📌 **Final Answer**: ${solution.final_answer}`;
      }
      if (solution.steps && solution.steps.length) {
        responseText += `\n\n💡 **Key Step**: ${solution.steps[0]}`;
      }

      setChat(prev => [...prev, { sender: 'vidya', text: responseText, fullSolution: solution }]);
    } catch (err) {
      setChat(prev => [...prev, { sender: 'vidya', text: 'I faced a network error while fetching solution, but here is a quick tip: check formula units and basic principles!' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="floating-ask-vidya">
      {!isOpen ? (
        <button className="floating-btn" onClick={() => setIsOpen(true)}>
          <i className="fa-solid fa-robot"></i> Ask Vidya 🤖
        </button>
      ) : (
        <div className="glass-card" style={{
          width: 360,
          height: 520,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--accent-primary)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <i className="fa-solid fa-brain" style={{ color: 'var(--accent-primary)' }}></i> Ask Vidya AI
            </div>
            <button className="icon-btn" onClick={() => setIsOpen(false)} style={{ width: 28, height: 28 }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Mode Selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['INTERMEDIATE MODE', 'GUIDED/SOCRATIC MODE'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  fontSize: 10,
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: mode === m ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {m.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, paddingRight: 4 }}>
            {chat.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.sender === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: 12, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Vidya AI is analyzing doubt...
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Ask any question or doubt..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none'
              }}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
