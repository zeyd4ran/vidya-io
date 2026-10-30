import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DashboardChecklistAndCounter from './components/DashboardChecklistAndCounter';
import RoleSwitcher from './components/RoleSwitcher';
import SearchBar from './components/SearchBar';
import SidebarNavItem from './components/SidebarNavItem';
import SidebarSection from './components/SidebarSection';
import SmartSessionButton from './components/SmartSessionButton';
import ThemeToggle from './components/ThemeToggle';
import MindMapCanvas from './components/MindMapCanvas';
import AssessmentEngine from './components/AssessmentEngine';
import {
  BarChart3,
  BookOpen,
  Brain,
  Bell,
  CalendarCheck,
  ChartLine,
  ArrowUpRight,
  CircleHelp,
  ClipboardCheck,
  GraduationCap,
  Layers3,
  MessageCircle,
  Presentation,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

const workspaceHeroCopy = {
  tutor: {
    eyebrow: '24×7 AI TUTOR',
    title: 'Make your next question count.',
    description: 'Ask a doubt, choose how you want to learn, and let Vidya guide the next step.',
  },
  content: {
    eyebrow: 'AI CONTENT',
    title: 'Turn the syllabus into a study path.',
    description: 'Find the right lecture sequence and spend less time sorting through noise.',
  },
  video: {
    eyebrow: 'VIDEO ANALYZER',
    title: 'Learn from every minute of a lecture.',
    description: 'Convert educational videos into notes, mind maps, and practice questions.',
  },
  tests: {
    eyebrow: 'TEST MAKER',
    title: 'Practice with a plan.',
    description: 'Generate focused tests that expose the topics worth revisiting next.',
  },
  revision: {
    eyebrow: 'REVISION QUEUE',
    title: 'Keep the important things in motion.',
    description: 'Your spaced revision queue is organized around what needs attention now.',
  },
};

function WorkspaceHero({ route, onAction }) {
  const copy = workspaceHeroCopy[route] || {
    eyebrow: 'VIDYA AI WORKSPACE',
    title: 'Your prep, organized around progress.',
    description: 'Everything you need for a focused study session, in one place.',
  };

  return (
    <section className="workspace-hero">
      <div className="workspace-hero-copy">
        <span>{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      <button className="btn btn-primary workspace-hero-action" onClick={onAction} type="button">
        <Sparkles size={15} /> Start Smart Session
      </button>
    </section>
  );
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [currentRoute, setCurrentRoute] = useState(() => new URLSearchParams(window.location.search).get('view') || 'landing');
  const [activeRole, setActiveRole] = useState('student');
  const [token, setToken] = useState(localStorage.getItem('vidya_token') || '');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Feature States
  const [doubtText, setDoubtText] = useState('');
  const [doubtMode, setDoubtMode] = useState('INTERMEDIATE MODE');
  const [doubtResult, setDoubtResult] = useState(null);

  const [ytQuery, setYtQuery] = useState('');
  const [ytData, setYtData] = useState(null);

  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoResult, setVideoResult] = useState(null);

  const [activeTest, setActiveTest] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [studyRooms, setStudyRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMsgInput, setRoomMsgInput] = useState('');
  const [roomMessages, setRoomMessages] = useState([]);

  const [communityPosts, setCommunityPosts] = useState([]);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');

  const [leaderboard, setLeaderboard] = useState([]);
  const [notes, setNotes] = useState([]);
  const [mindmaps, setMindmaps] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [revisionItems, setRevisionItems] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [plannerData, setPlannerData] = useState(null);
  const [adminData, setAdminData] = useState(null);

  // Fetch Current User
  useEffect(() => {
    if (token) fetchUserData();
  }, [token]);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        setOnboarding(data.onboarding);
      }
      fetchDashboard();
    } catch (e) {
      console.warn('User fetch warning', e);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setDashboardData(data);
    } catch (e) {
      console.warn('Dashboard fetch warning', e);
    }
  };

  // Route-based Data Loading
  useEffect(() => {
    if (currentRoute === 'study-rooms') fetchStudyRooms();
    if (currentRoute === 'community') fetchCommunity();
    if (currentRoute === 'leaderboard') fetchLeaderboard();
    if (currentRoute === 'notes') fetchNotes();
    if (currentRoute === 'mindmaps') fetchMindmaps();
    if (currentRoute === 'flashcards') fetchFlashcards();
    if (currentRoute === 'revision') fetchRevision();
    if (currentRoute === 'assessments') fetchAssessments();
    if (currentRoute === 'planner') fetchPlanner();
    if (currentRoute === 'admin') fetchAdmin();
  }, [currentRoute]);

  const fetchStudyRooms = async () => {
    const res = await fetch('/api/study-rooms', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setStudyRooms(data.rooms || []);
  };

  const fetchCommunity = async () => {
    const res = await fetch('/api/community/posts', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setCommunityPosts(data.posts || []);
  };

  const fetchLeaderboard = async () => {
    const res = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setLeaderboard(data.entries || []);
  };

  const fetchNotes = async () => {
    const res = await fetch('/api/notes', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setNotes(data.notes || []);
  };

  const fetchMindmaps = async () => {
    const res = await fetch('/api/mindmaps', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setMindmaps(data.mindmaps || []);
  };

  const fetchFlashcards = async () => {
    const res = await fetch('/api/flashcards', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setFlashcards(data.flashcards || []);
  };

  const fetchRevision = async () => {
    const res = await fetch('/api/revision', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setRevisionItems(data.items || []);
  };

  const fetchAssessments = async () => {
    const res = await fetch('/api/assessments', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setAssessments(data.attempts || []);
  };

  const fetchPlanner = async () => {
    const res = await fetch('/api/planner', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setPlannerData(data);
  };

  const fetchAdmin = async () => {
    const res = await fetch('/api/admin/overview', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setAdminData(data);
  };

  // Login Handler
  const handleLogin = async (email, pass) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('vidya_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setOnboarding(data.onboarding);
      setCurrentRoute('dashboard');
    }
  };

  // AI Actions
  const handleSolveDoubt = async (e) => {
    e.preventDefault();
    if (!doubtText) return;
    setLoading(true);
    const res = await fetch('/api/ai/doubt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt: doubtText, mode: doubtMode })
    });
    const data = await res.json();
    setDoubtResult(data.solution);
    setLoading(false);
  };

  const handleSearchYouTube = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/content/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: ytQuery })
    });
    const data = await res.json();
    setYtData(data.data);
    setLoading(false);
  };

  const handleAnalyzeVideo = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/video/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ videoUrl: videoUrlInput, subject: 'Physics', topic: 'Electrostatics' })
    });
    const data = await res.json();
    setVideoResult(data.result);
    setLoading(false);
  };

  const handleGenerateTest = async (subject = 'Physics', topic = 'Capacitance') => {
    setLoading(true);
    const res = await fetch('/api/tests/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ subject, topic, totalQuestions: 5 })
    });
    const data = await res.json();
    setActiveTest(data.test);
    setCurrentRoute('test-runner');
    setLoading(false);
  };

  const handleSubmitTest = async (answers, timeSpentSecs) => {
    setLoading(true);
    const res = await fetch('/api/tests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ testId: activeTest.id, userAnswers: answers, timeSpentSecs })
    });
    const data = await res.json();
    setTestResult(data);
    setCurrentRoute('test-result');
    setLoading(false);
    fetchDashboard();
  };

  const handleStartSmartRevision = async () => {
    const res = await fetch('/api/revision/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    alert(data.message);
    fetchRevision();
    fetchDashboard();
  };

  const handleJoinRoom = async (room) => {
    const res = await fetch('/api/study-rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ roomId: room.id })
    });
    const data = await res.json();
    setActiveRoom(data.room);
    setRoomMessages(data.messages || []);
  };

  const handleSendRoomMsg = async (e) => {
    e.preventDefault();
    if (!roomMsgInput || !activeRoom) return;
    const res = await fetch('/api/study-rooms/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ roomId: activeRoom.id, text: roomMsgInput })
    });
    const data = await res.json();
    setRoomMessages(prev => [...prev, data.message]);
    setRoomMsgInput('');
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title: newPostTitle, content: newPostContent, domain_tag: 'JEE Main' })
    });
    const data = await res.json();
    setCommunityPosts(prev => [data.post, ...prev]);
    setNewPostTitle('');
    setNewPostContent('');
  };

  const handleUpvotePost = async (postId) => {
    const res = await fetch('/api/community/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ postId })
    });
    const data = await res.json();
    setCommunityPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: data.upvotes } : p));
  };

  // Render Landing Page if currentRoute is 'landing'
  if (currentRoute === 'landing') {
    return (
      <LandingPage
        onStartLearning={() => {
          setCurrentRoute('dashboard');
        }}
        onExplore={() => {
          setCurrentRoute('dashboard');
        }}
      />
    );
  }

  return (
    <div className={`app-container ${theme}-theme`}>
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-header" onClick={() => setCurrentRoute('landing')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-icon"><Sparkles size={18} strokeWidth={1.8} /></div>
          <div className="sidebar-brand">
            <strong>Vidya</strong>
            <span>AI learning workspace</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <SidebarSection title="MAIN">
            <SidebarNavItem icon={BarChart3} label="Dashboard" href="?view=dashboard" isActive={currentRoute === 'dashboard'} onClick={() => setCurrentRoute('dashboard')} />
            <SidebarNavItem icon={Brain} label="AI Tutor" href="?view=tutor" isActive={currentRoute === 'tutor'} onClick={() => setCurrentRoute('tutor')} />
            <SidebarNavItem icon={CalendarCheck} label="Study Planner" href="?view=planner" isActive={currentRoute === 'planner'} onClick={() => setCurrentRoute('planner')} />
            <SidebarNavItem icon={BookOpen} label="Notes" href="?view=notes" isActive={currentRoute === 'notes'} onClick={() => setCurrentRoute('notes')} />
            <SidebarNavItem icon={Layers3} label="Mind Maps" href="?view=mindmaps" isActive={currentRoute === 'mindmaps'} onClick={() => setCurrentRoute('mindmaps')} />
            <SidebarNavItem icon={Layers3} label="Flashcards" href="?view=flashcards" isActive={currentRoute === 'flashcards'} onClick={() => setCurrentRoute('flashcards')} />
            <SidebarNavItem icon={CircleHelp} label="Question Bank" href="?view=tests" isActive={currentRoute === 'tests'} onClick={() => setCurrentRoute('tests')} />
            <SidebarNavItem icon={ClipboardCheck} label="Assessments" href="?view=assessments" isActive={currentRoute === 'assessments'} onClick={() => setCurrentRoute('assessments')} />
            <SidebarNavItem icon={ChartLine} label="Analytics" href="?view=leaderboard" isActive={currentRoute === 'leaderboard'} onClick={() => setCurrentRoute('leaderboard')} />
            <SidebarNavItem icon={Play} label="Video Library" href="?view=video" isActive={currentRoute === 'video'} onClick={() => setCurrentRoute('video')} />
          </SidebarSection>

          <SidebarSection title="SUPPORT">
            <SidebarNavItem icon={RotateCcw} label="Revision Queue" href="?view=revision" isActive={currentRoute === 'revision'} badge="High" onClick={() => setCurrentRoute('revision')} />
            <SidebarNavItem icon={ChartLine} label="Performance" href="?view=leaderboard" isActive={currentRoute === 'leaderboard'} onClick={() => setCurrentRoute('leaderboard')} />
            <SidebarNavItem icon={CircleHelp} label="Settings" href="?view=profile" isActive={currentRoute === 'profile'} onClick={() => setCurrentRoute('profile')} />
            {user?.role === 'admin' && (
              <SidebarNavItem icon={ShieldCheck} label="Admin Panel" href="?view=admin" isActive={currentRoute === 'admin'} onClick={() => setCurrentRoute('admin')} />
            )}
          </SidebarSection>
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar">{profile?.avatar || '🎓'}</div>
          <div className="user-info">
            <div className="user-name">{profile?.name || 'Alex Johnson'}</div>
            <div className="user-role">{onboarding?.exam || 'JEE 2027 Aspirant'}</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main">
        <header className="top-bar">
          <div className="page-title-area">
            <span className="top-bar-kicker">VIDYA AI</span>
            <h2>{currentRoute === 'dashboard' ? 'Command Center' : currentRoute.toUpperCase().replace('-', ' ')}</h2>
          </div>
          <div className="top-actions">
            <SearchBar />

            {/* Single role switcher */}
            <RoleSwitcher
              activeRole={activeRole}
              onRoleChange={(role) => {
                setActiveRole(role);
                handleLogin(`${role}@vidya.ai`, 'password123');
              }}
            />
            <button className="notification-button" type="button" aria-label="Notifications">
              <Bell size={16} strokeWidth={1.8} />
              <span className="notification-dot" />
            </button>
            <div className="top-profile-avatar" aria-label="Alex Johnson profile">AJ</div>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </header>

        <div className="content-body">
          {currentRoute !== 'dashboard' && !['test-runner', 'test-result'].includes(currentRoute) && (
            <WorkspaceHero route={currentRoute} onAction={handleStartSmartRevision} />
          )}

          {/* 1. DASHBOARD VIEW */}
          {currentRoute === 'dashboard' && (
            <div className="dashboard-view">
              <section className="workspace-dashboard-hero dashboard-welcome">
                <div className="dashboard-hero-copy">
                  <span className="dashboard-eyebrow">COMMAND CENTER</span>
                  <h1>{dashboardData?.insights?.greeting || 'Good evening, Alex Johnson'}</h1>
                  <p>Stay focused on what matters today.</p>
                </div>
                <div className="dashboard-hero-actions">
                  <span className="dashboard-hero-note">AI has prepared a focused study session for you.</span>
                  <SmartSessionButton onClick={handleStartSmartRevision} />
                </div>
              </section>

              <DashboardChecklistAndCounter />

            </div>
          )}

          {/* 2. 24x7 AI TUTOR VIEW */}
          {currentRoute === 'tutor' && (
            <div className="tutor-view">
              <div className="glass-card tutor-panel">
                <h3>24×7 Socratic AI Doubt Solver</h3>
                <div className="tutor-mode-tabs" role="tablist" aria-label="Tutor mode">
                  {['BEGINNER MODE', 'INTERMEDIATE MODE', 'ADVANCED MODE', 'GUIDED/SOCRATIC MODE'].map(m => (
                    <button
                      key={m}
                      className={`tutor-mode-tab ${doubtMode === m ? 'is-active' : ''}`}
                      onClick={() => setDoubtMode(m)}
                      role="tab"
                      aria-selected={doubtMode === m}
                      type="button"
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <form className="tutor-input-row" onSubmit={handleSolveDoubt}>
                  <input
                    type="text"
                    placeholder="Ask any physics, chemistry, or math doubt..."
                    value={doubtText}
                    onChange={e => setDoubtText(e.target.value)}
                  />
                  <button className="btn btn-primary tutor-submit" type="submit" disabled={loading}>
                    {loading ? 'Analyzing...' : 'Ask AI Tutor'}
                  </button>
                </form>

                <div className="tutor-suggestions" aria-label="Suggested doubts">
                  <span className="tutor-suggestions-label">Try asking</span>
                  {[
                    'Explain torque vs moment of inertia',
                    'Solve this integral',
                    "What's the SI unit of...",
                  ].map(suggestion => (
                    <button
                      className="tutor-suggestion-chip"
                      key={suggestion}
                      type="button"
                      onClick={() => setDoubtText(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {doubtResult && (
                  <div className="tutor-result">
                    <h4 className="tutor-result-title">AI Derivation & Explanation ({doubtMode})</h4>
                    <p style={{ fontSize: 14, marginBottom: 14 }}>{doubtResult.summary}</p>

                    {doubtResult.formula && (
                      <div className="tutor-formula">
                        <strong>Formula:</strong> {doubtResult.formula}
                      </div>
                    )}

                    {doubtResult.steps && (
                      <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                        {doubtResult.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}

                    <div className="tutor-result-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => alert('Saved to Notes!')}>Save to Notes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => alert('Added to Revision Queue!')}>Add to Revision</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. AI CONTENT CURATION & YOUTUBE VIEW */}
          {currentRoute === 'content' && (
            <div>
              <div className="glass-card">
                <h3>YouTube AI Filtration & Curation</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Search syllabus topic to generate a 4-step structured learning sequence.</p>

                <form onSubmit={handleSearchYouTube} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="Search e.g. Electrostatics JEE beginner..."
                    value={ytQuery}
                    onChange={e => setYtQuery(e.target.value)}
                    style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Curating...' : 'Search & Filter'}
                  </button>
                </form>

                {ytData && (
                  <div>
                    <h4 style={{ marginBottom: 14 }}>AI Learning Sequence</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
                      {(ytData.ai_learning_sequence || []).map((seq, i) => (
                        <div key={i} style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{seq.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duration: {seq.duration} • {seq.focus}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. VIDEO ANALYZER VIEW */}
          {currentRoute === 'video' && (
            <div>
              <div className="glass-card">
                <h3>AI Video to Notes, Mind Map & Quiz Generator</h3>
                <form onSubmit={handleAnalyzeVideo} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="url"
                    placeholder="Enter educational video URL..."
                    value={videoUrlInput}
                    onChange={e => setVideoUrlInput(e.target.value)}
                    style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Analyze Video'}
                  </button>
                </form>

                {videoResult && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="glass-card">
                      <h4>📝 Generated Notes</h4>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: 13 }}>{videoResult.notes_markdown}</pre>
                    </div>
                    <div className="glass-card">
                      <h4>🧠 Generated Mind Map</h4>
                      <MindMapCanvas data={videoResult.mindmap_json} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. TEST MAKER VIEW */}
          {currentRoute === 'tests' && (
            <div>
              <div className="glass-card">
                <h3>AI Test & Assessment Maker</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Generate custom exam tests tailored to your target exam level.</p>
                <div style={{ display: 'flex', gap: 14 }}>
                  <button className="btn btn-primary" onClick={() => handleGenerateTest('Physics', 'Capacitance')}>
                    ⚡ Physics Capacitance Test
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleGenerateTest('Mathematics', 'Calculus')}>
                    📐 Math Calculus Test
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEST RUNNER INTERFACE */}
          {currentRoute === 'test-runner' && activeTest && (
            <AssessmentEngine
              test={activeTest}
              onSubmitTest={handleSubmitTest}
              onBack={() => setCurrentRoute('tests')}
            />
          )}

          {/* TEST RESULT INTERFACE */}
          {currentRoute === 'test-result' && testResult && (
            <div className="glass-card" style={{ maxWidth: 800, margin: '0 auto', border: '1px solid var(--accent-success)' }}>
              <h3 style={{ color: 'var(--accent-success)', marginBottom: 12 }}>Assessment Submission Complete!</h3>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                Score: {testResult.attempt?.score} / {testResult.attempt?.total_score} ({testResult.attempt?.accuracy_pct}%)
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                <strong>AI Mistake Classifier:</strong> {testResult.mistakeAnalysis?.ai_recommendation}
              </div>
              <button className="btn btn-primary" onClick={() => setCurrentRoute('dashboard')}>
                Return to Command Center
              </button>
            </div>
          )}

          {/* 6. REVISION TRACKER VIEW */}
          {currentRoute === 'revision' && (
            <div>
              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title">🔄 AI Spaced Revision Queue</div>
                  <button className="btn btn-primary btn-sm" onClick={handleStartSmartRevision}>Start Smart Revision</button>
                </div>
                {revisionItems.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.subject} • {r.type}</div>
                    </div>
                    <span className="badge-priority-high">{r.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. STUDY ROOMS VIEW */}
          {currentRoute === 'study-rooms' && (
            <div>
              <div className="glass-card">
                <h3>👥 Active Group Study Rooms</h3>
                {!activeRoom ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 16 }}>
                    {studyRooms.map(room => (
                      <div key={room.id} style={{ background: 'var(--bg-secondary)', padding: 18, borderRadius: 14, border: '1px solid var(--border-color)' }}>
                        <h4 style={{ color: 'var(--accent-primary)' }}>{room.title}</h4>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 12px' }}>{room.goal}</p>
                        <button className="btn btn-primary btn-sm" onClick={() => handleJoinRoom(room)}>Join Room</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveRoom(null)} style={{ marginBottom: 16 }}>← Leave Room</button>
                    <h4>{activeRoom.title}</h4>
                    <div style={{ height: 300, overflowY: 'auto', background: 'var(--bg-secondary)', padding: 16, borderRadius: 12, margin: '14px 0' }}>
                      {roomMessages.map((m, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <strong>{m.sender_name}:</strong> {m.text}
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendRoomMsg} style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Type room message..."
                        value={roomMsgInput}
                        onChange={e => setRoomMsgInput(e.target.value)}
                        style={{ flex: 1, padding: 10, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                      />
                      <button className="btn btn-primary btn-sm" type="submit">Send</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. COMMUNITY VIEW */}
          {currentRoute === 'community' && (
            <div>
              <div className="glass-card">
                <h3>💬 Student Community Forum</h3>
                <form onSubmit={handleCreatePost} style={{ margin: '16px 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Post title (e.g. Best strategy for Capacitance...)"
                    value={newPostTitle}
                    onChange={e => setNewPostTitle(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                  <textarea
                    placeholder="Write details..."
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    rows={3}
                    style={{ padding: 10, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                  <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: 'flex-start' }}>Post Question</button>
                </form>

                {communityPosts.map(post => (
                  <div key={post.id} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{post.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>by {post.author_name} ({post.author_role}) • Tag: {post.domain_tag}</div>
                    <p style={{ fontSize: 14, marginBottom: 10 }}>{post.content}</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleUpvotePost(post.id)}>
                      ▲ Upvote ({post.upvotes})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. LEADERBOARD VIEW */}
          {currentRoute === 'leaderboard' && (
            <div>
              <div className="glass-card">
                <h3>🏆 Domain Leaderboards</h3>
                <div style={{ margin: '16px 0' }}>
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 8 }}>
                      <div>
                        <strong>#{idx + 1} {entry.name}</strong> ({entry.domain})
                      </div>
                      <div>Productivity Score: <strong style={{ color: 'var(--accent-primary)' }}>{entry.productivity_score}</strong> • Streak: {entry.streak} Days</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* OTHER ROUTE FALLBACKS */}
          {!['dashboard', 'tutor', 'content', 'video', 'tests', 'test-runner', 'test-result', 'revision', 'study-rooms', 'community', 'leaderboard'].includes(currentRoute) && (
            <div className="glass-card">
              <h3>{currentRoute.toUpperCase()} Module Active</h3>
              <p style={{ color: 'var(--text-muted)' }}>Connected to Vidya AI backend engine.</p>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
