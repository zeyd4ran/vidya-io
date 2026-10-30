import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  MoreHorizontal,
  RotateCcw,
  Sigma,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import StudyGoalInput from './StudyGoalInput';
import TaskCheckbox from './TaskCheckbox';

function MetricCard({ icon: Icon, label, value, detail, trend, tone = 'blue' }) {
  return (
    <article className="dashboard-metric-card">
      <div className={`dashboard-metric-icon is-${tone}`}><Icon size={15} strokeWidth={1.8} /></div>
      <div className="dashboard-metric-label">{label}</div>
      <div className="dashboard-metric-value">{value}</div>
      <div className="dashboard-metric-detail">{trend ? <span className="metric-trend"><TrendingUp size={11} /> {trend}</span> : detail}</div>
    </article>
  );
}

function Sparkline({ points, tone = 'blue' }) {
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  return (
    <svg className={`dashboard-sparkline is-${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ProgressBar({ value, tone = 'blue' }) {
  return (
    <div className={`dashboard-mini-progress is-${tone}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

const analytics = [
  { label: 'Study Time', value: '4h 32m', trend: '12% this week', tone: 'blue', points: [[0, 25], [12, 20], [25, 22], [37, 12], [50, 17], [62, 11], [75, 15], [87, 5], [100, 9]] },
  { label: 'Questions Solved', value: '128', trend: '18% this week', tone: 'purple', points: [[0, 25], [12, 22], [25, 23], [37, 17], [50, 20], [62, 11], [75, 14], [87, 5], [100, 9]] },
  { label: 'Accuracy', value: '78%', trend: '8% this week', tone: 'green', points: [[0, 26], [12, 23], [25, 24], [37, 17], [50, 20], [62, 15], [75, 14], [87, 9], [100, 7]] },
  { label: 'Tests Attempted', value: '12', trend: '10% this week', tone: 'amber', points: [[0, 26], [12, 25], [25, 19], [37, 21], [50, 15], [62, 17], [75, 10], [87, 12], [100, 5]] },
  { label: 'Concepts Mastered', value: '36', trend: '15% this week', tone: 'purple', points: [[0, 26], [12, 22], [25, 24], [37, 15], [50, 18], [62, 13], [75, 15], [87, 7], [100, 9]] },
];

export default function DashboardChecklistAndCounter() {
  const targetDate = new Date('2027-01-24T09:00:00');
  const getTimeRemaining = () => {
    const total = targetDate - new Date();
    return {
      days: Math.max(0, Math.floor(total / (1000 * 60 * 60 * 24))),
      hours: Math.max(0, Math.floor((total / (1000 * 60 * 60)) % 24)),
      minutes: Math.max(0, Math.floor((total / (1000 * 60)) % 60)),
      seconds: Math.max(0, Math.floor((total / 1000) % 60)),
    };
  };

  const [timeLeft, setTimeLeft] = useState(getTimeRemaining);
  const [newTodoText, setNewTodoText] = useState('');
  const [todos, setTodos] = useState([
    { id: 1, text: 'Physics: Revise Capacitance & Dielectrics formulas', completed: true, xp: 50 },
    { id: 2, text: 'Chemistry: Complete Organic Reaction Flashcards', completed: true, xp: 30 },
    { id: 3, text: 'Mathematics: Watch Definite Integration Video', completed: true, xp: 40 },
    { id: 4, text: 'Assessment: Attempt 15-min Electrostatics Mock Test', completed: false, xp: 60 },
    { id: 5, text: "Revision: Review 5 mistakes from yesterday's test", completed: true, xp: 30 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeRemaining()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTodo = (id) => {
    setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const handleAddTodo = (event) => {
    event.preventDefault();
    if (!newTodoText.trim()) return;
    setTodos((current) => [...current, {
      id: current.length ? Math.max(...current.map((todo) => todo.id)) + 1 : 1,
      text: newTodoText.trim(),
      completed: false,
      xp: 30,
    }]);
    setNewTodoText('');
  };

  const completedCount = todos.filter((todo) => todo.completed).length;
  const progressPct = Math.round((completedCount / Math.max(todos.length, 1)) * 100);
  const countdown = [
    [timeLeft.days, 'Days', 'blue'],
    [String(timeLeft.hours).padStart(2, '0'), 'Hrs', 'purple'],
    [String(timeLeft.minutes).padStart(2, '0'), 'Mins', 'blue'],
    [String(timeLeft.seconds).padStart(2, '0'), 'Secs', 'muted'],
  ];

  return (
    <div className="dashboard-overview">
      <section className="dashboard-metrics" aria-label="Performance overview">
        <MetricCard icon={CalendarDays} label="Days to Exam" value={timeLeft.days} detail="days" tone="blue" />
        <MetricCard icon={Flame} label="Study Streak" value="12" detail="days" tone="amber" />
        <MetricCard icon={Target} label="Today's Focus" value="Electrostatics" detail="Physics" tone="green" />
        <MetricCard icon={Clock3} label="Study Hours (This Week)" value="26h 45m" trend="12% from last week" tone="purple" />
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary-column">
          <div className="dashboard-workbench-grid">
            <section className="dashboard-surface dashboard-plan-card">
              <div className="dashboard-surface-header">
                <div>
                  <h2>Today's Plan</h2>
                  <p>{completedCount} of {todos.length} tasks completed</p>
                </div>
                <div className="dashboard-plan-summary"><span>{progressPct}%</span><ProgressBar value={progressPct} /></div>
              </div>
              <div className="dashboard-todo-list">
                {todos.map((todo) => (
                  <TaskCheckbox key={todo.id} checked={todo.completed} taskId={todo.id} onToggle={toggleTodo} xpValue={todo.xp}>
                    <span className="dashboard-todo-text">{todo.text}</span>
                  </TaskCheckbox>
                ))}
              </div>
              <StudyGoalInput value={newTodoText} onChange={(event) => setNewTodoText(event.target.value)} onSubmit={handleAddTodo} />
            </section>

            <section className="dashboard-surface dashboard-exam-card">
              <div className="dashboard-surface-header">
                <div>
                  <h2>JEE Main 2027 Countdown</h2>
                  <p>Target exam date · Jan 24, 2027</p>
                </div>
                <MoreHorizontal size={16} className="dashboard-muted-icon" />
              </div>
              <div className="dashboard-countdown-values">
                {countdown.map(([value, label, tone]) => (
                  <div className={`dashboard-countdown-value is-${tone}`} key={label}>
                    <strong>{value}</strong><span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="dashboard-progress-stat"><span>Syllabus Progress</span><b>68%</b></div>
              <ProgressBar value={68} />
              <div className="dashboard-progress-stat"><span>Mock Test Progress</span><b>52%</b></div>
              <ProgressBar value={52} />
              <div className="dashboard-exam-footer"><span>Target Score: <b>280 / 300</b></span><span>AIR Target: <b>&lt; 500</b></span></div>
            </section>
          </div>

          <section className="dashboard-analytics-section">
            <div className="dashboard-section-title"><h2>Your Learning Analytics</h2><button type="button">View all <ArrowUpRight size={13} /></button></div>
            <div className="dashboard-analytics-grid">
              {analytics.map((item) => (
                <article className="dashboard-analytics-card" key={item.label}>
                  <div className={`dashboard-analytics-dot is-${item.tone}`} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small><TrendingUp size={10} /> {item.trend}</small>
                  <Sparkline points={item.points} tone={item.tone} />
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-intelligence" aria-label="Academic intelligence">
          <section className="dashboard-surface intelligence-card">
            <div className="dashboard-surface-header"><h2>This Week&apos;s Goal</h2><span className="dashboard-card-kicker">18 / 25</span></div>
            <div className="intelligence-goal-value"><strong>18</strong><span>/ 25 Tasks</span></div>
            <ProgressBar value={72} />
          </section>

          <section className="dashboard-surface intelligence-card">
            <div className="dashboard-surface-header"><h2>Streak &amp; XP</h2><Flame size={15} className="dashboard-amber-icon" /></div>
            <div className="activity-grid" aria-label="Weekly activity">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <div className="activity-day" key={`${day}-${index}`}><span>{day}</span><i className={index > 4 ? 'is-muted' : ''} /></div>
              ))}
            </div>
            <div className="intelligence-split-stats"><span>Current Streak<strong>12 days</strong></span><span>Total XP<strong>2,450</strong></span></div>
          </section>

          <section className="dashboard-surface intelligence-card">
            <div className="dashboard-surface-header"><h2>Top Subjects</h2><Activity size={15} className="dashboard-blue-icon" /></div>
            <div className="subjects-chart-row">
              <div className="subjects-donut" />
              <div className="subjects-legend">
                <span><i className="is-blue" /> Physics <b>45%</b></span>
                <span><i className="is-purple" /> Chemistry <b>30%</b></span>
                <span><i className="is-green" /> Mathematics <b>25%</b></span>
              </div>
            </div>
            <button className="intelligence-link" type="button">View Analytics <ArrowUpRight size={13} /></button>
          </section>

          <section className="dashboard-surface intelligence-card revision-card">
            <div className="dashboard-surface-header"><h2>Next up in Revision Queue</h2><RotateCcw size={14} className="dashboard-blue-icon" /></div>
            {['Rotational Motion', 'Thermodynamics', 'Chemical Bonding'].map((topic, index) => (
              <div className="revision-item" key={topic}><span className={`revision-dot is-${index === 2 ? 'amber' : 'blue'}`} /><div><strong>{topic}</strong><small>{index === 2 ? 'Chemistry' : 'Physics'}</small></div></div>
            ))}
            <button className="intelligence-link" type="button">View All <ArrowUpRight size={13} /></button>
          </section>

          <section className="dashboard-surface intelligence-card ai-insight-card">
            <div className="dashboard-surface-header"><h2>AI Study Insight</h2><Sparkles size={14} className="ai-insight-mark" /></div>
            <p>Your accuracy in Electrostatics has improved <b>14%</b> this week. Capacitance combinations remain below your average.</p>
            <div className="ai-recommendation"><span>Recommended action</span><strong>Complete 10 mixed capacitance problems before your next mock test.</strong></div>
            <button className="intelligence-link" type="button">Start Practice <ArrowUpRight size={13} /></button>
          </section>
        </aside>
      </div>
    </div>
  );
}