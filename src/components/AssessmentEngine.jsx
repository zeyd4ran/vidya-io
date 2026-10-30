import React, { useState, useEffect } from 'react';

export default function AssessmentEngine({ test, onSubmitTest, onBack }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [timeLeft, setTimeLeft] = useState((test?.time_limit_mins || 15) * 60);

  const questions = test?.questions_json || test?.questions || [];

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const currentQ = questions[currentQIndex] || {};

  const handleSelectOption = (opt) => {
    setAnswers({ ...answers, [currentQ.id || currentQIndex]: opt });
  };

  const toggleMarkReview = () => {
    const qId = currentQ.id || currentQIndex;
    setMarkedForReview({ ...markedForReview, [qId]: !markedForReview[qId] });
  };

  const handleSubmit = () => {
    if (onSubmitTest) {
      onSubmitTest(answers, (test?.time_limit_mins * 60) - timeLeft);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Test Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800 }}>{test?.title || 'AI Practice Assessment'}</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{test?.subject} • {test?.difficulty} Level • {questions.length} Questions</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="badge-priority-high" style={{ fontSize: 15, padding: '6px 14px' }}>
            ⏳ {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>Exit</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Main Question Display */}
        <div>
          <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 14, border: '1px solid var(--border-color)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Question {currentQIndex + 1} of {questions.length}</span>
              <button
                onClick={toggleMarkReview}
                style={{
                  background: markedForReview[currentQ.id || currentQIndex] ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                {markedForReview[currentQ.id || currentQIndex] ? '★ Marked for Review' : '☆ Mark for Review'}
              </button>
            </div>

            <h4 style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 18 }}>{currentQ.question}</h4>

            {/* Options Render */}
            {currentQ.options ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentQ.options.map((opt, oIdx) => {
                  const selected = answers[currentQ.id || currentQIndex] === opt;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectOption(opt)}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 12,
                        border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: selected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: selected ? 700 : 500,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Enter Numerical Answer:</label>
                <input
                  type="text"
                  placeholder="Type exact value..."
                  value={answers[currentQ.id || currentQIndex] || ''}
                  onChange={e => setAnswers({ ...answers, [currentQ.id || currentQIndex]: e.target.value })}
                  style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                />
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              className="btn btn-secondary"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
            >
              ← Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={currentQIndex === questions.length - 1}
              onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))}
            >
              Next →
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              Submit Assessment
            </button>
          </div>
        </div>

        {/* Question Palette Sidebar */}
        <div style={{ background: 'var(--bg-secondary)', padding: 18, borderRadius: 14, border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Question Palette</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
            {questions.map((q, idx) => {
              const qId = q.id || idx;
              const isAnswered = answers[qId] !== undefined;
              const isReview = markedForReview[qId];
              const isCurrent = currentQIndex === idx;

              let bg = 'var(--bg-tertiary)';
              if (isAnswered) bg = 'var(--accent-success)';
              if (isReview) bg = 'var(--accent-purple)';

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQIndex(idx)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: isCurrent ? '2px solid #fff' : 'none',
                    background: bg,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
            <div>🟩 Answered</div>
            <div>🟪 Marked for Review</div>
            <div>⬛ Unanswered</div>
          </div>
        </div>
      </div>
    </div>
  );
}
