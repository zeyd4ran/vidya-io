const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, saveDB } = require('./db');
const aiService = require('./aiService');
const aiGateway = require('./aiGateway');
const { generateTestFromBank, getQuestions, addQuestion, getStats: getQuestionBankStats, verifyQuestion } = require('./questionBank');
const { calculateSM2 } = require('./spacedRepetition');
const { indexDocument, buildRAGContext } = require('./ragEngine');
const { createJob, getJobStatus, listJobs, startWorker, onJobComplete, getDeadLetterQueue, retryDeadLetter, STATES: JOB_STATES } = require('./jobQueue');
const { initRealtime, broadcastToRoom } = require('./realtime');
const { saveUpload, getFileRecord, getFileStream, deleteFile, listFiles } = require('./uploadService');

const app = express();
const PORT = process.env.PORT || 5000;

// P0-6: Require JWT_SECRET from the environment; exit at startup with a clear error if it is missing outside development
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV !== 'development') {
    console.error('FATAL: JWT_SECRET environment variable is required. Set it before starting the server.');
    process.exit(1);
  } else {
    JWT_SECRET = 'dev_jwt_secret_vidya_ai_local';
  }
}

app.use(cors());
// P1-6: Lower body limit from 50mb to 1mb
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// P0-5: Serializer that strips sensitive fields from user objects
const publicUser = ({ password_hash, ...rest }) => rest;

// P1-1: Wrap async handlers so rejected promises reach the Express error handler
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// P0-2: Proper JWT authentication — reject when missing or invalid
function authenticateToken(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// P0-4: Role-based authorisation guard
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });

// P1-6: Basic input validation helpers
function validateBody(schema) {
  return (req, res, next) => {
    for (const [field, rule] of Object.entries(schema)) {
      const value = req.body[field];
      if (rule.required && (value === undefined || value === null || value === '')) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (value !== undefined && value !== null) {
        if (rule.type === 'string' && typeof value !== 'string') {
          return res.status(400).json({ error: `${field} must be a string` });
        }
        if (rule.type === 'string' && rule.minLength && value.length < rule.minLength) {
          return res.status(400).json({ error: `${field} must be at least ${rule.minLength} characters` });
        }
        if (rule.type === 'string' && rule.maxLength && value.length > rule.maxLength) {
          return res.status(400).json({ error: `${field} must be at most ${rule.maxLength} characters` });
        }
        if (rule.type === 'integer') {
          const parsed = parseInt(value, 10);
          if (isNaN(parsed)) return res.status(400).json({ error: `${field} must be an integer` });
          if (rule.min !== undefined && parsed < rule.min) return res.status(400).json({ error: `${field} must be at least ${rule.min}` });
          if (rule.max !== undefined && parsed > rule.max) return res.status(400).json({ error: `${field} must be at most ${rule.max}` });
          req.body[field] = parsed; // coerce for downstream use
        }
      }
    }
    next();
  };
}

// ----------------------------------------------------
// 0. HEALTH CHECK ENDPOINTS
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'VIDYA AI Backend System', timestamp: new Date().toISOString() });
});

app.get('/api/health/database', (req, res) => {
  res.json({ status: 'UP', database: 'Persistent Relational Store', user_count: db.users.length });
});

app.get('/api/health/services', (req, res) => {
  res.json({
    status: 'UP',
    services: {
      aiEngine: 'Operational',
      sm2SpacedRepetition: 'Active',
      ragVectorEngine: 'Active',
      backgroundJobQueue: 'Active',
      realtimeWebSockets: 'Active'
    }
  });
});

// ----------------------------------------------------
// 1. AUTHENTICATION & PROFILE ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  // P0-3: Ignore any role from the body — always create 'student'
  const role = 'student';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) return res.status(400).json({ error: 'User already exists' });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUserId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;

  const newUser = { id: newUserId, email: email.toLowerCase(), password_hash: hashedPassword, role, created_at: new Date().toISOString() };
  const newProfile = { user_id: newUserId, name: name || email.split('@')[0], avatar: '🎓', bio: 'Student on Vidya AI' };

  db.users.push(newUser);
  db.profiles.push(newProfile);
  db.streaks.push({ user_id: newUserId, current_streak: 1, max_streak: 1, last_activity_date: new Date().toISOString().split('T')[0] });
  db.productivity_scores.push({ user_id: newUserId, overall_score: 75, consistency: 80, assessment: 70, activity: 75, revision: 75, updated_at: new Date().toISOString() });

  saveDB();
  const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  // P0-5: Strip password_hash from response
  res.json({ token, user: publicUser(newUser), profile: newProfile });
});

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  // P0-1: Use the same generic message for "no such user" and "wrong password"
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  // P0-1: Actually verify the password
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const profile = db.profiles.find(p => p.user_id === user.id) || { name: 'Student', avatar: '🎓' };
  const onboarding = db.onboarding.find(o => o.user_id === user.id) || null;

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  // P0-5: Strip password_hash from response
  res.json({ token, user: publicUser(user), profile, onboarding });
}));

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const profile = db.profiles.find(p => p.user_id === user.id) || { name: 'Student', avatar: '🎓' };
  const onboarding = db.onboarding.find(o => o.user_id === user.id) || null;
  // P0-5: Strip password_hash from response
  res.json({ user: publicUser(user), profile, onboarding });
});

// ----------------------------------------------------
// 2. DASHBOARD ENDPOINT
// ----------------------------------------------------
app.get('/api/dashboard', authenticateToken, wrap(async (req, res) => {
  const userId = req.user.id;
  const user = db.users.find(u => u.id === userId);
  const profile = db.profiles.find(p => p.user_id === userId) || { name: 'Student', avatar: '🎓' };
  const onboarding = db.onboarding.find(o => o.user_id === userId) || null;
  const streak = db.streaks.find(s => s.user_id === userId) || { current_streak: 14, max_streak: 20 };
  const productivity = db.productivity_scores.find(p => p.user_id === userId) || { overall_score: 84, consistency: 92, assessment: 80, activity: 85, revision: 78 };
  const revisionItems = db.revision_items.filter(r => r.user_id === userId);

  const insights = await aiService.generateDailyInsights({ userProfile: profile, streak: streak.current_streak, productivityScore: productivity.overall_score });

  res.json({
    // P0-5: Strip password_hash from response
    user: user ? publicUser(user) : null,
    profile,
    onboarding,
    streak,
    productivity,
    insights,
    todays_revision: revisionItems.slice(0, 3)
  });
}));

// ----------------------------------------------------
// 3. 24x7 AI TUTOR & RAG CONTEXT ENDPOINTS
// ----------------------------------------------------

// Phase 2: Budget check endpoint
app.get('/api/ai/budget', authenticateToken, (req, res) => {
  const budget = aiGateway.checkBudget(req.user.id);
  res.json(budget);
});

// Original JSON doubt endpoint (kept for backward compat)
app.post('/api/ai/doubt', authenticateToken, validateBody({
  prompt: { required: true, type: 'string', minLength: 1, maxLength: 4000 }
}), wrap(async (req, res) => {
  const { prompt, subject, topic, mode } = req.body;

  // Phase 2: Check AI budget before calling provider
  const budget = aiGateway.checkBudget(req.user.id);
  if (!budget.allowed) {
    return res.status(429).json({ error: budget.reason, budget });
  }

  // Build RAG Context from uploaded notes/documents
  const rag = buildRAGContext(prompt, req.user.id);

  const solution = await aiService.solveDoubt({
    prompt,
    subject: subject || 'Physics',
    topic: topic || 'Electrostatics & Capacitance',
    mode: mode || 'INTERMEDIATE MODE',
    context: rag.contextText
  });

  // Phase 2: Log usage
  aiGateway.logUsage(req.user.id, 'doubt-solver', aiGateway.getUserDailyUsage(req.user.id) > 0 ? 500 : 800, 'doubt_solver');

  const newDoubtId = db.doubts.length ? Math.max(...db.doubts.map(d => d.id)) + 1 : 1;
  const newDoubt = {
    id: newDoubtId,
    user_id: req.user.id,
    title: prompt.slice(0, 60),
    input_type: 'text',
    subject: subject || 'Physics',
    topic: topic || 'General',
    mode: mode || 'INTERMEDIATE MODE',
    solution_json: solution,
    citations: rag.citations,
    created_at: new Date().toISOString()
  };

  db.doubts.push(newDoubt);
  saveDB();
  res.json({ success: true, doubt: newDoubt, solution, citations: rag.citations });
}));

// Phase 2: SSE Streaming doubt endpoint — users see text immediately
app.get('/api/ai/doubt/stream', authenticateToken, wrap(async (req, res) => {
  const { prompt, subject, topic, mode } = req.query;
  if (!prompt || prompt.length < 1) return res.status(400).json({ error: 'prompt query parameter is required' });
  if (prompt.length > 4000) return res.status(400).json({ error: 'prompt must be at most 4000 characters' });

  // Budget check
  const budget = aiGateway.checkBudget(req.user.id);
  if (!budget.allowed) {
    return res.status(429).json({ error: budget.reason, budget });
  }

  // Build RAG context
  const rag = buildRAGContext(prompt, req.user.id);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  });

  // Stream from AI Gateway
  const params = {
    subject: subject || 'Physics',
    topic: topic || 'Electrostatics & Capacitance',
    mode: mode || 'INTERMEDIATE MODE',
    userLevel: 'Class 12',
    prompt,
    context: rag.contextText
  };

  try {
    for await (const chunk of aiGateway.stream(req.user.id, 'doubt_solver_stream', params)) {
      if (chunk.budgetExceeded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: chunk.text })}\n\n`);
        break;
      }
      if (chunk.done) {
        res.write(`event: done\ndata: ${JSON.stringify({ citations: rag.citations })}\n\n`);
        break;
      }
      res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
  }

  res.end();
}));

// ----------------------------------------------------
// 4. FLASHCARDS & SM-2 SPACED REPETITION ENDPOINTS
// ----------------------------------------------------
app.get('/api/flashcards', authenticateToken, (req, res) => {
  const flashcards = db.flashcards.filter(f => f.user_id === req.user.id);
  res.json({ flashcards });
});

app.post('/api/flashcards/review', authenticateToken, validateBody({
  cardId: { required: true },
  quality: { required: true, type: 'integer', min: 0, max: 5 }
}), (req, res) => {
  const { cardId, quality } = req.body;
  const card = db.flashcards.find(f => f.id === parseInt(cardId, 10));
  if (!card) return res.status(404).json({ error: 'Flashcard not found' });
  // Ownership check
  if (card.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const sm2Result = calculateSM2({
    quality,
    repetitions: card.repetitions || 0,
    interval: card.interval || 1,
    easinessFactor: card.easiness_factor || 2.5
  });

  Object.assign(card, {
    repetitions: sm2Result.repetitions,
    interval: sm2Result.interval,
    easiness_factor: sm2Result.easinessFactor,
    next_review_date: sm2Result.nextReviewDate,
    status: sm2Result.status
  });

  // Log review entry
  const newRevId = db.flashcard_reviews.length ? Math.max(...db.flashcard_reviews.map(r => r.id)) + 1 : 1;
  db.flashcard_reviews.push({
    id: newRevId,
    card_id: card.id,
    user_id: req.user.id,
    rating: quality,
    review_date: new Date().toISOString()
  });

  saveDB();
  res.json({ success: true, card, sm2Result });
});

// ----------------------------------------------------
// 5. BACKGROUND JOB QUEUE ENDPOINTS (Phase 3)
// ----------------------------------------------------

// List user's jobs
app.get('/api/jobs', authenticateToken, (req, res) => {
  const { status, limit, offset } = req.query;
  const result = listJobs(req.user.id, {
    status,
    limit: parseInt(limit || '20', 10),
    offset: parseInt(offset || '0', 10)
  });
  res.json(result);
});

// Create a job (API only enqueues — worker processes it)
app.post('/api/jobs/create', authenticateToken, validateBody({
  type: { required: true, type: 'string', minLength: 1, maxLength: 100 }
}), (req, res) => {
  const { type, ...payload } = req.body;
  payload.userId = req.user.id;   // Attach owner for handler use
  const job = createJob(type, payload, req.user.id, {
    idempotencyKey: req.body.idempotencyKey || null,
    priority: parseInt(req.body.priority || '0', 10)
  });
  res.json({ success: true, job });
});

// Get job status
app.get('/api/jobs/:id', authenticateToken, (req, res) => {
  const job = getJobStatus(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  res.json({ job });
});

// Phase 3: File upload endpoint
app.post('/api/upload', authenticateToken, express.raw({ type: '*/*', limit: '11mb' }), wrap(async (req, res) => {
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  const originalName = req.headers['x-filename'] || 'upload';
  const file = saveUpload(req.body, originalName, mimeType, req.user.id);
  res.json({ success: true, file: { id: file.id, original_name: file.original_name, size_bytes: file.size_bytes, mime_type: file.mime_type } });
}));

// List user's uploaded files
app.get('/api/uploads', authenticateToken, (req, res) => {
  const files = listFiles(req.user.id);
  res.json({ files: files.map(f => ({ id: f.id, original_name: f.original_name, size_bytes: f.size_bytes, mime_type: f.mime_type, created_at: f.created_at })) });
});

// Download a file
app.get('/api/uploads/:id', authenticateToken, (req, res) => {
  const record = getFileRecord(parseInt(req.params.id, 10));
  if (!record) return res.status(404).json({ error: 'File not found' });
  if (record.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const { stream, record: fileRec } = getFileStream(record.id);
  res.setHeader('Content-Type', fileRec.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${fileRec.original_name}"`);
  stream.pipe(res);
});

// Delete a file
app.delete('/api/uploads/:id', authenticateToken, (req, res) => {
  const deleted = deleteFile(parseInt(req.params.id, 10), req.user.id);
  if (!deleted) return res.status(404).json({ error: 'File not found' });
  res.json({ success: true });
});

// ----------------------------------------------------
// 6. CONTENT, VIDEO & NOTES ENDPOINTS
// ----------------------------------------------------
app.post('/api/content/youtube', authenticateToken, wrap(async (req, res) => {
  const { query, subject, topic } = req.body;
  const data = await aiService.filterYouTubeContent({ query, subject, topic });
  res.json({ success: true, data });
}));

app.post('/api/video/analyze', authenticateToken, wrap(async (req, res) => {
  const { videoUrl, videoTitle, subject, topic } = req.body;
  const result = await aiService.processVideoContent({ videoUrl, videoTitle, subject, topic });

  // Index notes into RAG vector engine with userId
  indexDocument({ docId: `vid_${Date.now()}`, title: result.title, content: result.notes_markdown, type: 'video_notes', subject: subject || 'Physics', userId: req.user.id });

  res.json({ success: true, result });
}));

app.get('/api/notes', authenticateToken, (req, res) => {
  const notes = db.notes.filter(n => n.user_id === req.user.id);
  res.json({ notes });
});

app.get('/api/mindmaps', authenticateToken, (req, res) => {
  const mindmaps = db.mind_maps.filter(m => m.user_id === req.user.id);
  res.json({ mindmaps });
});

// ----------------------------------------------------
// 7. TESTS & ASSESSMENTS ENDPOINTS
// ----------------------------------------------------
app.post('/api/tests/generate', authenticateToken, validateBody({
  totalQuestions: { type: 'integer', min: 1, max: 50 }
}), wrap(async (req, res) => {
  const { subject, topic, difficulty, totalQuestions, exam } = req.body;

  // Phase 2: Try question bank first; fall back to AI-generated if bank has insufficient questions
  const bankResult = generateTestFromBank({ subject, topic, difficulty, totalQuestions: totalQuestions || 5, exam });

  let testData;
  if (bankResult.questions.length >= (totalQuestions || 5)) {
    // Enough questions in the bank
    testData = bankResult;
  } else if (bankResult.questions.length > 0) {
    // Partial: use bank questions + fill remaining with AI
    const aiData = await aiService.generateTest({ subject, topic, difficulty, totalQuestions: (totalQuestions || 5) - bankResult.questions.length, exam });
    testData = {
      ...bankResult,
      questions: [...bankResult.questions, ...aiData.questions],
      total_questions: bankResult.questions.length + aiData.questions.length,
      source: 'mixed'
    };
  } else {
    // Bank empty for these filters — full AI fallback
    testData = await aiService.generateTest({ subject, topic, difficulty, totalQuestions, exam });
  }

  const newTestId = db.tests.length ? Math.max(...db.tests.map(t => t.id)) + 1 : 1;
  const newTest = {
    id: newTestId,
    user_id: req.user.id,
    title: testData.title,
    subject: testData.subject,
    topic: testData.topic,
    difficulty: testData.difficulty,
    total_questions: testData.total_questions,
    time_limit_mins: testData.time_limit_mins,
    questions_json: testData.questions,
    created_at: new Date().toISOString()
  };

  db.tests.push(newTest);
  saveDB();

  // P0-7: Strip correct_answer and explanation from response — reveal only on submit
  const sanitizedQuestions = testData.questions.map(({ correct_answer, explanation, ...q }) => q);
  const { questions_json, ...testMeta } = newTest;
  res.json({ success: true, test: { ...testMeta, questions_json: sanitizedQuestions } });
}));

app.post('/api/tests/submit', authenticateToken, wrap(async (req, res) => {
  const { testId, userAnswers, timeSpentSecs } = req.body;

  // P1-2: Proper lookup — no fallback to tests[0]
  const test = db.tests.find(t => t.id === parseInt(testId, 10));
  if (!test) return res.status(404).json({ error: 'Test not found' });

  // P1-2: Ownership check
  if (test.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const questions = test.questions_json || [];

  // P1-2: Guard empty question list (would produce NaN accuracy)
  if (questions.length === 0) {
    return res.status(400).json({ error: 'Test has no questions' });
  }

  // P1-2: Reject re-submission of the same test
  const existingAttempt = db.test_attempts.find(a => a.test_id === test.id && a.user_id === req.user.id);
  if (existingAttempt) {
    return res.status(409).json({ error: 'Test already submitted' });
  }

  let correctCount = 0;
  const evaluatedAnswers = questions.map((q, idx) => {
    const userAns = (userAnswers && userAnswers[q.id || idx]) || (userAnswers && userAnswers[idx]) || '';
    const isCorrect = String(userAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
    if (isCorrect) correctCount++;
    return { question_id: q.id || idx, user_answer: userAns, is_correct: isCorrect, explanation: q.explanation };
  });

  const accuracyPct = Math.round((correctCount / questions.length) * 100);
  const newAttemptId = db.test_attempts.length ? Math.max(...db.test_attempts.map(a => a.id)) + 1 : 1;

  const attempt = {
    id: newAttemptId,
    test_id: test.id,
    user_id: req.user.id,
    score: correctCount,
    total_score: questions.length,
    accuracy_pct: accuracyPct,
    time_spent_secs: timeSpentSecs || 300,
    submitted_at: new Date().toISOString()
  };

  db.test_attempts.push(attempt);
  const mistakeAnalysis = await aiService.analyzeMistakes({ answers: evaluatedAnswers, questions });

  saveDB();
  res.json({ success: true, attempt, evaluatedAnswers, mistakeAnalysis });
}));

app.get('/api/assessments', authenticateToken, (req, res) => {
  const attempts = db.test_attempts.filter(a => a.user_id === req.user.id);
  res.json({ attempts });
});

// ----------------------------------------------------
// 8. REVISION, PLANNER, SOCIAL & ADMIN ENDPOINTS
// ----------------------------------------------------
app.get('/api/revision', authenticateToken, (req, res) => {
  const items = db.revision_items.filter(r => r.user_id === req.user.id);
  res.json({ items });
});

// P1-7: Only mark the specific items provided, not every item
app.post('/api/revision/start-session', authenticateToken, (req, res) => {
  const { itemIds } = req.body;
  const userItems = db.revision_items.filter(r => r.user_id === req.user.id);

  if (Array.isArray(itemIds) && itemIds.length > 0) {
    // Mark only the specified items as revised
    userItems.forEach(r => {
      if (itemIds.includes(r.id)) r.status = 'Revised';
    });
  } else {
    // If no specific IDs provided, still require explicit items — don't mark all
    return res.status(400).json({ error: 'itemIds array is required' });
  }

  saveDB();
  res.json({ success: true, message: 'Smart Revision Session Completed!' });
});

app.get('/api/planner', authenticateToken, (req, res) => {
  res.json({
    exam_countdown_days: 527,
    daily_schedule: [
      { time: '07:00 AM - 08:30 AM', task: '⚡ Physics: Capacitance Numerical Practice (10 Qs)', priority: 'High' },
      { time: '09:00 AM - 10:30 AM', task: '🧪 Chemistry: Organic Reaction Mechanisms Flashcards', priority: 'Medium' }
    ]
  });
});

app.get('/api/study-rooms', authenticateToken, (req, res) => {
  res.json({ rooms: db.study_rooms });
});

// P1-7: No fallback to room 1 — return 404 for unknown room
app.post('/api/study-rooms/join', authenticateToken, (req, res) => {
  const { roomId } = req.body;
  const room = db.study_rooms.find(r => r.id === parseInt(roomId, 10));
  if (!room) return res.status(404).json({ error: 'Study room not found' });
  const messages = db.room_messages.filter(m => m.room_id === room.id);
  res.json({ success: true, room, messages });
});

// P1-7: Use real user profile name instead of hardcoded 'Student'
app.post('/api/study-rooms/message', authenticateToken, validateBody({
  text: { required: true, type: 'string', minLength: 1, maxLength: 2000 }
}), (req, res) => {
  const { roomId, text } = req.body;
  const profile = db.profiles.find(p => p.user_id === req.user.id);
  const senderName = profile ? profile.name : 'Student';
  const newMsg = { id: db.room_messages.length + 1, room_id: parseInt(roomId, 10), user_id: req.user.id, sender_name: senderName, text, created_at: new Date().toISOString() };
  db.room_messages.push(newMsg);
  saveDB();
  res.json({ success: true, message: newMsg });
});

app.get('/api/community/posts', authenticateToken, (req, res) => {
  res.json({ posts: db.forum_posts });
});

// P1-7: Use real user profile name instead of hardcoded 'Student'
app.post('/api/community/posts', authenticateToken, validateBody({
  title: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
  content: { required: true, type: 'string', minLength: 1, maxLength: 2000 }
}), (req, res) => {
  const { title, content } = req.body;
  const profile = db.profiles.find(p => p.user_id === req.user.id);
  const authorName = profile ? profile.name : 'Student';
  const newPost = { id: db.forum_posts.length + 1, user_id: req.user.id, author_name: authorName, author_role: req.user.role || 'Student', domain_tag: 'JEE Main', title, content, upvotes: 1, created_at: new Date().toISOString() };
  db.forum_posts.unshift(newPost);
  saveDB();
  res.json({ success: true, post: newPost });
});

// P1-7: One vote per user using forum_likes collection
app.post('/api/community/upvote', authenticateToken, (req, res) => {
  const { postId } = req.body;
  const post = db.forum_posts.find(p => p.id === parseInt(postId, 10));
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Check if user already liked this post
  const existingLike = db.forum_likes.find(l => l.post_id === post.id && l.user_id === req.user.id);
  if (existingLike) {
    return res.status(409).json({ error: 'Already upvoted', upvotes: post.upvotes });
  }

  post.upvotes += 1;
  const newLikeId = db.forum_likes.length ? Math.max(...db.forum_likes.map(l => l.id)) + 1 : 1;
  db.forum_likes.push({ id: newLikeId, post_id: post.id, user_id: req.user.id });
  saveDB();
  res.json({ success: true, upvotes: post.upvotes });
});

app.get('/api/leaderboard', authenticateToken, (req, res) => {
  res.json({ entries: db.leaderboard_entries });
});

// P0-4: Admin routes require admin role
app.get('/api/admin/overview', authenticateToken, requireRole('admin'), (req, res) => {
  res.json({
    total_users: db.users.length,
    active_rooms: db.study_rooms.length,
    total_tests: db.tests.length,
    question_bank: getQuestionBankStats()
  });
});

// Phase 2: Question Bank admin routes
app.get('/api/admin/question-bank', authenticateToken, requireRole('admin', 'teacher'), (req, res) => {
  const { subject, topic, difficulty } = req.query;
  const questions = getQuestions({ subject, topic, difficulty, count: 100 });
  const stats = getQuestionBankStats();
  res.json({ questions, stats });
});

app.post('/api/admin/question-bank', authenticateToken, requireRole('admin', 'teacher'), validateBody({
  question: { required: true, type: 'string', minLength: 10, maxLength: 2000 },
  correct_answer: { required: true, type: 'string', minLength: 1, maxLength: 500 },
  subject: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  topic: { required: true, type: 'string', minLength: 1, maxLength: 100 }
}), (req, res) => {
  try {
    const entry = addQuestion(req.body);
    res.json({ success: true, question: entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/question-bank/:id/verify', authenticateToken, requireRole('admin', 'teacher'), (req, res) => {
  const q = verifyQuestion(parseInt(req.params.id, 10));
  if (!q) return res.status(404).json({ error: 'Question not found' });
  res.json({ success: true, question: q });
});

// Phase 3: Dead-letter queue admin routes
app.get('/api/admin/dead-letter', authenticateToken, requireRole('admin'), (req, res) => {
  const dlq = getDeadLetterQueue();
  res.json({ jobs: dlq, count: dlq.length });
});

app.post('/api/admin/dead-letter/:id/retry', authenticateToken, requireRole('admin'), (req, res) => {
  const job = retryDeadLetter(req.params.id);
  if (!job) return res.status(404).json({ error: 'Dead-letter job not found' });
  res.json({ success: true, job });
});

app.use('/api/focus', require('./focus/focusRoutes'));

// P1-1: Global error handler for async errors
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
});

// Serve static frontend build
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.send('<h2>VIDYA AI Backend Running</h2>');
  }
});

// Create HTTP server & attach WebSockets
const server = http.createServer(app);
initRealtime(server);

// Phase 3: Wire job completion notifications via WebSocket
onJobComplete((job) => {
  if (job.user_id) {
    broadcastToRoom(`user_${job.user_id}`, {
      type: 'JOB_UPDATE',
      job: { id: job.id, type: job.type, status: job.status, progress: job.progress, result: job.result, error: job.error }
    });
  }
});

// Only listen when run directly (not when imported by tests)
if (require.main === module) {
  // Phase 3: Start the in-process worker (use worker.js for separate deployable)
  startWorker();

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 VIDYA AI Production Server running at http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

// Export for testing with supertest
module.exports = { app, server };
