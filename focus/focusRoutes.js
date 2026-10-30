/**
 * FocusLearn Express Routes (focusRoutes.js)
 * Mount point: /api/focus
 * All routes are behind authenticateToken and scoped to req.user.id.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const store = require('./focusStore');
const logic = require('./focusLogic');
const ai = require('./focusAI');

const router = express.Router();

// Parse JSON payloads up to 5MB for screenshot/snapshot images
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ limit: '5mb', extended: true }));

/**
 * JWT Authentication Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server authentication configuration missing' });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// Protect all /api/focus routes with authentication
router.use(authenticateToken);

/**
 * Async error handler wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error('[FocusAPI Error]:', err.message);
      const status = err.statusCode || 500;
      res.status(status).json({
        error: err.message || 'An internal error occurred in FocusLearn'
      });
    });
  };
}

// ----------------------------------------------------
// 1. STATE & SETTINGS ENDPOINTS
// ----------------------------------------------------

/**
 * GET /api/focus/state
 */
router.get('/state', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  const gaps = logic.computeConceptAccuracy(state.q);
  const nextLesson = logic.calculateNextLesson(state.v, state.q, state.domain);
  const stats = logic.calculateStats(state.v, state.q, state.secs);

  res.json({
    domain: state.domain,
    locked: state.locked,
    secs: state.secs,
    v: state.v,
    q: state.q,
    gaps,
    nextLesson,
    stats
  });
}));

/**
 * GET /api/focus/settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  res.json({
    domain: state.domain,
    locked: state.locked,
    secs: state.secs
  });
}));

/**
 * PUT /api/focus/settings
 */
router.put('/settings', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domain, locked, secs } = req.body;

  if (domain !== undefined && (typeof domain !== 'string' || !domain.trim())) {
    return res.status(400).json({ error: 'Domain must be a non-empty string' });
  }
  if (locked !== undefined && typeof locked !== 'boolean') {
    return res.status(400).json({ error: 'Locked must be a boolean' });
  }
  if (secs !== undefined && (typeof secs !== 'number' || isNaN(secs) || secs < 0)) {
    return res.status(400).json({ error: 'Secs must be a non-negative number' });
  }

  const updated = store.updateSettings(userId, { domain, locked, secs });
  res.json({
    domain: updated.domain,
    locked: updated.locked,
    secs: updated.secs
  });
}));

// ----------------------------------------------------
// 2. VIDEO LESSON ENDPOINTS (GET, POST, PATCH, PUT, DELETE)
// ----------------------------------------------------

/**
 * GET /api/focus/videos
 */
router.get('/videos', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  res.json({ videos: state.v });
}));

/**
 * POST /api/focus/videos
 */
router.post('/videos', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { urlOrId, id, title, domain, tags, tr, transcript, w, watched } = req.body;

  const rawId = urlOrId || id;
  if (!rawId || typeof rawId !== 'string') {
    return res.status(400).json({ error: 'Video URL or YouTube ID is required' });
  }

  const videoId = logic.extractYouTubeId(rawId);
  if (!videoId) {
    return res.status(400).json({ error: 'Paste a valid YouTube link or 11-character video ID' });
  }

  const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : `Lesson: ${videoId}`;
  const cleanDomain = (typeof domain === 'string' && domain.trim()) ? domain.trim() : null;

  let cleanTags = [];
  if (Array.isArray(tags)) {
    cleanTags = tags.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    cleanTags = tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const cleanTr = typeof tr === 'string' ? tr : (typeof transcript === 'string' ? transcript : '');
  const cleanWatched = Boolean(w !== undefined ? w : watched);

  const newVideo = store.addVideo(userId, {
    id: videoId,
    title: cleanTitle,
    domain: cleanDomain,
    tags: cleanTags,
    tr: cleanTr,
    w: cleanWatched
  });

  res.status(201).json({ success: true, video: newVideo });
}));

/**
 * PATCH /api/focus/videos/:id
 */
router.patch('/videos/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const videoId = req.params.id;
  const { title, domain, tags, tr, transcript, w, watched } = req.body;

  let cleanTags = undefined;
  if (Array.isArray(tags)) {
    cleanTags = tags.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    cleanTags = tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const cleanTr = tr !== undefined ? tr : transcript;
  const cleanWatched = w !== undefined ? w : watched;

  const updated = store.updateVideo(userId, videoId, {
    title,
    domain,
    tags: cleanTags,
    tr: cleanTr,
    w: cleanWatched
  });

  res.json({ success: true, video: updated });
}));

/**
 * PUT /api/focus/videos/:id (alias for update)
 */
router.put('/videos/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const videoId = req.params.id;
  const { title, domain, tags, tr, transcript, w, watched } = req.body;

  let cleanTags = undefined;
  if (Array.isArray(tags)) {
    cleanTags = tags.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    cleanTags = tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const cleanTr = tr !== undefined ? tr : transcript;
  const cleanWatched = w !== undefined ? w : watched;

  const updated = store.updateVideo(userId, videoId, {
    title,
    domain,
    tags: cleanTags,
    tr: cleanTr,
    w: cleanWatched
  });

  res.json({ success: true, video: updated });
}));

/**
 * DELETE /api/focus/videos/:id
 */
router.delete('/videos/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const videoId = req.params.id;

  const removed = store.deleteVideo(userId, videoId);
  res.json({ success: true, removed });
}));

// ----------------------------------------------------
// 3. ANALYSIS, GAPS, NEXT & PROGRESS ENDPOINTS
// ----------------------------------------------------

/**
 * GET /api/focus/gaps
 * Returns accuracy per concept and flagged gaps (<70%)
 */
router.get('/gaps', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  const concepts = logic.computeConceptAccuracy(state.q);
  const gaps = concepts.filter(c => c.isGap);

  res.json({ gaps, concepts });
}));

/**
 * GET /api/focus/next
 * Returns next recommended lesson according to weak concepts formula
 */
router.get('/next', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  const recommendation = logic.calculateNextLesson(state.v, state.q, state.domain);

  res.json({
    nextLesson: recommendation ? recommendation.lesson : null,
    reason: recommendation ? recommendation.reason : 'No lessons available in this subject.',
    allWatched: recommendation ? recommendation.allWatched : false,
    score: recommendation ? recommendation.score : 0
  });
}));

/**
 * GET /api/focus/progress
 * Returns hours studied, lessons watched, quiz scores, milestones
 */
router.get('/progress', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  const stats = logic.calculateStats(state.v, state.q, state.secs);

  res.json(stats);
}));

/**
 * POST /api/focus/timer
 */
router.post('/timer', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { secs } = req.body;

  if (typeof secs !== 'number' || isNaN(secs) || secs < 0) {
    return res.status(400).json({ error: 'secs must be a non-negative number' });
  }

  const updated = store.updateTimer(userId, secs);
  res.json({ success: true, secs: updated.secs });
}));

// ----------------------------------------------------
// 4. AI TUTOR (ASK) & QUIZ GENERATION / SUBMISSION
// ----------------------------------------------------

/**
 * POST /api/focus/ask
 * Snapshot bot: answers questions from text and optional screenshot
 */
router.post('/ask', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { question, tr, transcript, image, videoId } = req.body;

  if (!question && !image) {
    return res.status(400).json({ error: 'Either a question or an image must be provided' });
  }

  let lessonDomain = 'General';
  let lessonTitle = 'Lesson';
  let noteText = tr || transcript || '';

  if (videoId) {
    const state = store.getUserFocusData(userId);
    const lesson = state.v.find(item => item.id === videoId);
    if (lesson) {
      lessonDomain = lesson.domain || lessonDomain;
      lessonTitle = lesson.title || lessonTitle;
      if (!noteText) {
        noteText = lesson.tr || '';
      }
    }
  }

  const answer = await ai.answerSnapshotQuestion({
    question,
    tr: noteText,
    imageBase64: image,
    domain: lessonDomain,
    title: lessonTitle
  });

  res.json({ answer, source: 'ai' });
}));

/**
 * POST /api/focus/quiz/generate
 * Generates 5 multiple choice questions.
 * The server keeps the correct answers in pending storage and returns questions WITHOUT correct answers!
 */
router.post('/quiz/generate', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { videoId, title, domain, tr, transcript, tags } = req.body;

  let lessonTitle = title || 'Lesson';
  let lessonDomain = domain || 'General';
  let lessonTags = Array.isArray(tags) ? tags : [];
  let noteText = tr || transcript || '';

  if (videoId) {
    const state = store.getUserFocusData(userId);
    const lesson = state.v.find(item => item.id === videoId);
    if (lesson) {
      lessonTitle = lesson.title || lessonTitle;
      lessonDomain = lesson.domain || lessonDomain;
      lessonTags = lesson.tags && lesson.tags.length > 0 ? lesson.tags : lessonTags;
      if (!noteText) {
        noteText = lesson.tr || '';
      }
    }
  }

  // 1. Generate full questions with answers via AI
  const fullQuestions = await ai.generateQuizQuestions({
    title: lessonTitle,
    domain: lessonDomain,
    tags: lessonTags,
    tr: noteText
  });

  // 2. Keep correct answers securely on the server
  const quizId = store.storePendingQuiz(userId, videoId || null, fullQuestions);

  // 3. Return client questions WITHOUT correct answers or explanations
  const sanitizedQuestions = fullQuestions.map((q, idx) => ({
    id: idx,
    q: q.q,
    options: q.options,
    concept: q.concept
  }));

  res.json({
    quizId,
    videoId: videoId || null,
    questions: sanitizedQuestions
  });
}));

/**
 * POST /api/focus/quiz/submit
 * Grades on the server and returns score, per-question result, and explanations
 */
router.post('/quiz/submit', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { quizId, answers } = req.body;

  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({ error: 'quizId is required' });
  }

  const pending = store.getPendingQuiz(userId, quizId);
  if (!pending) {
    return res.status(404).json({ error: 'Quiz session not found or already submitted' });
  }

  const userAnswers = Array.isArray(answers)
    ? answers
    : (answers && typeof answers === 'object' ? answers : {});

  let score = 0;
  const hitConcepts = [];
  const missConcepts = [];
  const results = [];

  pending.questions.forEach((q, idx) => {
    const userChoice = userAnswers[idx] !== undefined ? Number(userAnswers[idx]) : -1;
    const isCorrect = userChoice === q.answer;

    if (isCorrect) {
      score += 1;
      hitConcepts.push(q.concept);
    } else {
      missConcepts.push(q.concept);
    }

    results.push({
      questionIndex: idx,
      q: q.q,
      userChoice,
      correctAnswer: q.answer,
      isCorrect,
      concept: q.concept,
      explanation: q.explanation
    });
  });

  // Record attempt in user's history
  const record = store.addQuizAttempt(userId, {
    id: pending.videoId || 'custom',
    s: score,
    n: pending.questions.length,
    hit: hitConcepts,
    miss: missConcepts,
    at: Date.now()
  });

  // Remove pending quiz from storage
  store.removePendingQuiz(userId, quizId);

  // Compute updated gaps & recommendations
  const state = store.getUserFocusData(userId);
  const gaps = logic.computeConceptAccuracy(state.q);
  const nextLesson = logic.calculateNextLesson(state.v, state.q, state.domain);

  res.json({
    success: true,
    score,
    total: pending.questions.length,
    results,
    hitConcepts,
    missConcepts,
    gaps,
    nextLesson,
    attempt: record
  });
}));


router.get('/quizzes', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const state = store.getUserFocusData(userId);
  res.json({ attempts: state.q });
}));

router.post('/quizzes', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { videoId, score, total, hitConcepts, missConcepts, at } = req.body;
  if (!videoId || typeof videoId !== 'string') return res.status(400).json({ error: 'videoId is required' });
  const s = parseInt(score, 10);
  const n = parseInt(total, 10);
  if (isNaN(s) || s < 0) return res.status(400).json({ error: 'score must be a non-negative integer' });
  if (isNaN(n) || n <= 0) return res.status(400).json({ error: 'total must be a positive integer' });
  if (s > n) return res.status(400).json({ error: 'score cannot exceed total' });
  const record = store.addQuizAttempt(userId, {
    id: videoId,
    s,
    n,
    hit: Array.isArray(hitConcepts) ? hitConcepts : [],
    miss: Array.isArray(missConcepts) ? missConcepts : [],
    at: typeof at === 'number' ? at : Date.now()
  });
  const state = store.getUserFocusData(userId);
  const gaps = logic.computeConceptAccuracy(state.q);
  const nextLesson = logic.calculateNextLesson(state.v, state.q, state.domain);
  res.status(201).json({ success: true, attempt: record, gaps, nextLesson });
}));

module.exports = router;
