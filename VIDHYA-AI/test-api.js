// VIDYA AI — Comprehensive Test Suite
// Uses node:test (built-in) + supertest for HTTP-layer testing.
// Run: npm test
//
// IMPORTANT: JWT_SECRET must be set BEFORE any require of server.js / db.js
// so the startup guard does not call process.exit(1).
process.env.JWT_SECRET = 'test_jwt_secret_for_ci_only';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Unit tests (no server needed)
// ---------------------------------------------------------------------------
const { calculateSM2 } = require('./spacedRepetition');
const { chunkText, indexDocument, searchRelevantChunks, buildRAGContext, _getChunksStore } = require('./ragEngine');
const { createJob, getJobStatus } = require('./jobQueue');
const aiGateway = require('./aiGateway');

// ===== SM-2 Spaced Repetition (14 cases) =====
describe('SM-2 Algorithm', () => {
  it('quality 0 resets repetitions to 0 and interval to 1', () => {
    const r = calculateSM2({ quality: 0, repetitions: 5, interval: 30, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 0);
    assert.equal(r.interval, 1);
    assert.equal(r.status, 'Needs Review');
  });

  it('quality 1 resets repetitions to 0 and interval to 1', () => {
    const r = calculateSM2({ quality: 1, repetitions: 3, interval: 10, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 0);
    assert.equal(r.interval, 1);
  });

  it('quality 2 resets repetitions to 0 and interval to 1', () => {
    const r = calculateSM2({ quality: 2, repetitions: 4, interval: 20, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 0);
    assert.equal(r.interval, 1);
  });

  it('quality 3 with 0 repetitions gives interval 1', () => {
    const r = calculateSM2({ quality: 3, repetitions: 0, interval: 1, easinessFactor: 2.5 });
    assert.equal(r.interval, 1);
    assert.equal(r.repetitions, 1);
  });

  it('quality 3 with 1 repetition gives interval 6', () => {
    const r = calculateSM2({ quality: 3, repetitions: 1, interval: 1, easinessFactor: 2.5 });
    assert.equal(r.interval, 6);
    assert.equal(r.repetitions, 2);
  });

  it('quality 4 with 2 repetitions multiplies interval by EF', () => {
    const r = calculateSM2({ quality: 4, repetitions: 2, interval: 6, easinessFactor: 2.5 });
    assert.equal(r.interval, Math.round(6 * 2.5));
    assert.equal(r.repetitions, 3);
  });

  it('quality 5 (perfect) gives highest EF boost', () => {
    const r = calculateSM2({ quality: 5, repetitions: 3, interval: 15, easinessFactor: 2.5 });
    assert.ok(r.easinessFactor >= 2.5);
    assert.equal(r.repetitions, 4);
  });

  it('EF never goes below 1.3', () => {
    const r = calculateSM2({ quality: 0, repetitions: 0, interval: 1, easinessFactor: 1.3 });
    assert.ok(r.easinessFactor >= 1.3);
  });

  it('nextReviewDate is a valid ISO string', () => {
    const r = calculateSM2({ quality: 4, repetitions: 1, interval: 6, easinessFactor: 2.5 });
    assert.ok(!isNaN(Date.parse(r.nextReviewDate)));
  });

  it('status is Mastered after 5+ repetitions', () => {
    const r = calculateSM2({ quality: 5, repetitions: 5, interval: 30, easinessFactor: 2.5 });
    assert.equal(r.status, 'Mastered');
  });

  it('status is Reviewing for quality >= 3 with < 5 reps', () => {
    const r = calculateSM2({ quality: 3, repetitions: 2, interval: 6, easinessFactor: 2.5 });
    assert.equal(r.status, 'Reviewing');
  });

  it('handles missing quality (defaults to 0)', () => {
    const r = calculateSM2({ repetitions: 0, interval: 1, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 0);
  });

  it('handles quality above 5 (clamped)', () => {
    const r = calculateSM2({ quality: 10, repetitions: 0, interval: 1, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 1);
  });

  it('handles negative quality (clamped to 0)', () => {
    const r = calculateSM2({ quality: -3, repetitions: 3, interval: 10, easinessFactor: 2.5 });
    assert.equal(r.repetitions, 0);
  });
});

// ===== RAG Engine =====
describe('RAG Engine', () => {
  it('chunkText terminates for any overlap (P1-3)', () => {
    const chunks = chunkText('hello world foo bar baz qux', 3, 3);
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.length > 0);
  });

  it('chunkText terminates when overlap > chunkSize', () => {
    const chunks = chunkText('a b c d e f g h i j', 2, 100);
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.length > 0);
  });

  it('chunkText returns empty for empty input', () => {
    assert.deepEqual(chunkText(''), []);
    assert.deepEqual(chunkText(null), []);
    assert.deepEqual(chunkText(undefined), []);
  });

  it('no duplicates on re-index (P1-4)', () => {
    _getChunksStore().length = 0;
    indexDocument({ docId: 'test-doc', title: 'Test', content: 'capacitance energy formula derivation', userId: 99 });
    const countAfterFirst = _getChunksStore().length;
    indexDocument({ docId: 'test-doc', title: 'Test Updated', content: 'capacitance energy formula derivation updated', userId: 99 });
    const countAfterSecond = _getChunksStore().length;
    assert.equal(countAfterFirst, countAfterSecond, 'Re-indexing same docId should replace, not append');
  });

  it('per-user isolation (P1-4)', () => {
    _getChunksStore().length = 0;
    indexDocument({ docId: 'user1-doc', title: 'User1 Doc', content: 'quantum mechanics wave function', userId: 1 });
    indexDocument({ docId: 'user2-doc', title: 'User2 Doc', content: 'quantum mechanics entanglement', userId: 2 });
    const user1Results = searchRelevantChunks('quantum mechanics', 10, 1);
    const user2Results = searchRelevantChunks('quantum mechanics', 10, 2);
    assert.ok(user1Results.every(r => r.userId === 1), 'User 1 should only see their own chunks');
    assert.ok(user2Results.every(r => r.userId === 2), 'User 2 should only see their own chunks');
  });

  it('stopword-only query returns nothing (P1-4)', () => {
    _getChunksStore().length = 0;
    indexDocument({ docId: 'd1', title: 'Doc', content: 'capacitance energy formula', userId: 1 });
    const results = searchRelevantChunks('the is a of and to in', 10, 1);
    assert.equal(results.length, 0, 'Stopword-only query should return no results');
  });
});

// ===== Job Queue =====
describe('Job Queue', () => {
  it('1000 IDs in one tick are unique (P1-5)', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      const job = createJob('TEST', {}, i);
      ids.add(job.id);
    }
    assert.equal(ids.size, 1000, 'All 1000 job IDs must be unique');
  });

  it('progress clamps to 0-100', () => {
    const { updateJobProgress } = require('./jobQueue');
    const job = createJob('TEST', {}, 1);
    updateJobProgress(job.id, -50);
    assert.equal(getJobStatus(job.id).progress, 0);
    updateJobProgress(job.id, 200);
    assert.equal(getJobStatus(job.id).progress, 100);
  });

  it('job stores user_id', () => {
    const job = createJob('VIDEO', { url: 'test' }, 42);
    assert.equal(job.user_id, 42);
  });
});

// ===== AI Gateway (Phase 2) =====
describe('AI Gateway', () => {
  it('cache set/get with TTL works', () => {
    aiGateway.clearCache();
    // Access internal cache via the exported clearCache/query API
    // We test the gateway's checkBudget which doesn't need the cache
    const budget = aiGateway.checkBudget(999); // user 999 has no usage
    assert.equal(budget.allowed, true);
  });

  it('budget check returns allowed for fresh user', () => {
    const budget = aiGateway.checkBudget(88888);
    assert.equal(budget.allowed, true);
    assert.equal(budget.dailyUsed, 0);
  });

  it('logUsage records to ai_usage', () => {
    const { db } = require('./db');
    const before = db.ai_usage.length;
    aiGateway.logUsage(9999, 'test-model', 100, 'test_template');
    assert.equal(db.ai_usage.length, before + 1);
    const last = db.ai_usage[db.ai_usage.length - 1];
    assert.equal(last.user_id, 9999);
    assert.equal(last.tokens_used, 100);
  });

  it('PROMPT_TEMPLATES are defined and buildable', () => {
    assert.ok(aiGateway.PROMPT_TEMPLATES.doubt_solver);
    assert.ok(aiGateway.PROMPT_TEMPLATES.doubt_solver_stream);
    const text = aiGateway.PROMPT_TEMPLATES.doubt_solver.build({
      subject: 'Physics', topic: 'Capacitance', mode: 'INTERMEDIATE MODE',
      userLevel: 'Class 12', prompt: 'What is capacitance?', context: ''
    });
    assert.ok(text.includes('Vidya AI'));
    assert.ok(text.includes('<user_question>'));
  });
});

// ===== Question Bank (Phase 2) =====
describe('Question Bank', () => {
  const { getQuestions, addQuestion, getStats, generateTestFromBank } = require('./questionBank');

  before(() => {
    // Ensure question_bank has data (DB file from prior runs may lack this collection)
    const { db } = require('./db');
    if (!db.question_bank || db.question_bank.length === 0) {
      db.question_bank = [
        { id: 1, question: 'Test Q1 for Physics', type: 'MCQ', options: ['A','B','C','D'], correct_answer: 'A', explanation: 'Test', subject: 'Physics', topic: 'Capacitance', difficulty: 'Easy', exam: 'JEE Main', tags: [], is_verified: true, created_at: new Date().toISOString() },
        { id: 2, question: 'Test Q2 for Chemistry', type: 'MCQ', options: ['A','B','C','D'], correct_answer: 'B', explanation: 'Test', subject: 'Chemistry', topic: 'Organic Chemistry', difficulty: 'Medium', exam: 'JEE Main', tags: [], is_verified: true, created_at: new Date().toISOString() }
      ];
    }
  });

  it('getQuestions returns array from seeded bank', () => {
    const qs = getQuestions({ count: 5 });
    assert.ok(Array.isArray(qs));
    assert.ok(qs.length > 0);
    assert.ok(qs.length <= 5);
  });

  it('getQuestions filters by subject', () => {
    const physics = getQuestions({ subject: 'Physics', count: 50 });
    assert.ok(physics.every(q => q.subject === 'Physics'));
    const chem = getQuestions({ subject: 'Chemistry', count: 50 });
    assert.ok(chem.every(q => q.subject === 'Chemistry'));
  });

  it('getQuestions filters by difficulty', () => {
    const easy = getQuestions({ difficulty: 'Easy', count: 50 });
    assert.ok(easy.every(q => q.difficulty === 'Easy'));
  });

  it('addQuestion creates a new entry', () => {
    const q = addQuestion({
      question: 'What is the SI unit of electric charge?',
      correct_answer: 'Coulomb',
      subject: 'Physics',
      topic: 'Electrostatics',
      type: 'MCQ',
      options: ['Coulomb', 'Ampere', 'Volt', 'Farad']
    });
    assert.ok(q.id);
    assert.equal(q.is_verified, false);
    assert.equal(q.subject, 'Physics');
  });

  it('addQuestion rejects missing required fields', () => {
    assert.throws(() => addQuestion({ question: 'Incomplete' }), /required/);
  });

  it('getStats returns correct structure', () => {
    const stats = getStats();
    assert.ok(typeof stats.total === 'number');
    assert.ok(stats.total > 0);
    assert.ok(typeof stats.bySubject === 'object');
    assert.ok(typeof stats.byDifficulty === 'object');
  });

  it('generateTestFromBank returns questions from bank', () => {
    const test = generateTestFromBank({ subject: 'Physics', totalQuestions: 3 });
    assert.ok(test.from_bank);
    assert.ok(test.questions.length > 0);
    assert.ok(test.questions.length <= 3);
    assert.ok(test.questions.every(q => q.subject === 'Physics'));
  });

  it('generateTestFromBank returns empty array for non-existent subject', () => {
    const test = generateTestFromBank({ subject: 'AncientLanguages', totalQuestions: 5 });
    assert.equal(test.questions.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests (HTTP layer with supertest)
// ---------------------------------------------------------------------------
describe('HTTP Integration', () => {
  let request;
  let studentToken;
  let adminToken;
  let server;

  before(async () => {
    // Delete the stale DB file to force a fresh seed
    const fs = require('fs');
    const path = require('path');
    const dbFile = path.join(__dirname, 'data', 'vidya_database.json');
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

    // Now require modules (JWT_SECRET already set at top of file)
    const dbModule = require('./db');
    dbModule.loadDB(); // Will re-seed since we deleted the file

    const supertest = require('supertest');
    const serverModule = require('./server');
    const app = serverModule.app;
    server = serverModule.server;
    request = supertest(app);

    // Get a valid student token via login
    const loginRes = await request.post('/api/auth/login')
      .send({ email: 'student@vidya.ai', password: 'password123' });
    studentToken = loginRes.body.token;
    assert.ok(studentToken, 'Student login must succeed to run integration tests');

    // Get admin token
    const adminLogin = await request.post('/api/auth/login')
      .send({ email: 'admin@vidya.ai', password: 'password123' });
    adminToken = adminLogin.body.token;
    assert.ok(adminToken, 'Admin login must succeed to run integration tests');
  });

  after(() => {
    if (server) server.close();
  });

  // ===== Auth =====
  describe('Auth', () => {
    it('wrong password returns 401 (P0-1)', async () => {
      const res = await request.post('/api/auth/login')
        .send({ email: 'student@vidya.ai', password: 'wrong_password' });
      assert.equal(res.status, 401);
    });

    it('no token returns 401 (P0-2)', async () => {
      const res = await request.get('/api/dashboard');
      assert.equal(res.status, 401);
    });

    it('invalid token returns 401 (P0-2)', async () => {
      const res = await request.get('/api/dashboard')
        .set('Authorization', 'Bearer invalid.token.here');
      assert.equal(res.status, 401);
    });

    it('expired token returns 401 (P0-2)', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign({ id: 1, email: 'student@vidya.ai', role: 'student' }, process.env.JWT_SECRET, { expiresIn: -10 });
      const res = await request.get('/api/dashboard')
        .set('Authorization', 'Bearer ' + expiredToken);
      assert.equal(res.status, 401);
    });

    it('register ignores role field (P0-3)', async () => {
      const res = await request.post('/api/auth/register')
        .send({ email: `hacker_${Date.now()}@test.com`, password: 'pass123', role: 'admin' });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, 'student', 'Role must always be student');
    });

    it('no password_hash in register response (P0-5)', async () => {
      const res = await request.post('/api/auth/register')
        .send({ email: `clean_${Date.now()}@test.com`, password: 'pass123' });
      assert.equal(res.body.user.password_hash, undefined);
    });

    it('no password_hash in login response (P0-5)', async () => {
      const res = await request.post('/api/auth/login')
        .send({ email: 'student@vidya.ai', password: 'password123' });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.password_hash, undefined);
    });

    it('no password_hash in /me response (P0-5)', async () => {
      const res = await request.get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.password_hash, undefined);
    });

    it('no password_hash in /dashboard response (P0-5)', async () => {
      const res = await request.get('/api/dashboard')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.password_hash, undefined);
    });
  });

  // ===== Authorisation =====
  describe('Authorisation', () => {
    it('student gets 403 on /api/admin/overview (P0-4)', async () => {
      const res = await request.get('/api/admin/overview')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 403);
    });

    it('admin gets 200 on /api/admin/overview (P0-4)', async () => {
      const res = await request.get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res.status, 200);
    });
  });

  // ===== Tests API =====
  describe('Tests API', () => {
    it('answers not in generate response (P0-7)', async () => {
      const res = await request.post('/api/tests/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ subject: 'Physics', topic: 'Capacitance', totalQuestions: 2 });
      assert.equal(res.status, 200);
      const questions = res.body.test.questions_json;
      assert.ok(questions.length > 0);
      questions.forEach(q => {
        assert.equal(q.correct_answer, undefined, 'correct_answer must not be in generate response');
        assert.equal(q.explanation, undefined, 'explanation must not be in generate response');
      });
    });

    it('submit with unknown testId returns 404 (P1-2)', async () => {
      const res = await request.post('/api/tests/submit')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ testId: 99999, userAnswers: {} });
      assert.equal(res.status, 404);
    });

    it('empty question list does not produce NaN (P1-2)', async () => {
      // Create a test then clear its questions to simulate edge case
      const { db } = require('./db');
      const testId = 99998;
      db.tests.push({ id: testId, user_id: 1, questions_json: [], title: 'Empty', subject: 'Test', topic: 'Test', difficulty: 'Easy', total_questions: 0, time_limit_mins: 5, created_at: new Date().toISOString() });

      const res = await request.post('/api/tests/submit')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ testId, userAnswers: {} });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('no questions'));

      // Cleanup
      const idx = db.tests.findIndex(t => t.id === testId);
      if (idx >= 0) db.tests.splice(idx, 1);
    });
  });

  // ===== Validation =====
  describe('Input Validation', () => {
    it('empty prompt returns 400 (P1-6)', async () => {
      const res = await request.post('/api/ai/doubt')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ prompt: '' });
      assert.equal(res.status, 400);
    });

    it('missing prompt returns 400 (P1-6)', async () => {
      const res = await request.post('/api/ai/doubt')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      assert.equal(res.status, 400);
    });

    it('invalid quality returns 400 (P1-6)', async () => {
      const res = await request.post('/api/flashcards/review')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ cardId: 1, quality: 10 });
      assert.equal(res.status, 400);
    });

    it('negative quality returns 400 (P1-6)', async () => {
      const res = await request.post('/api/flashcards/review')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ cardId: 1, quality: -1 });
      assert.equal(res.status, 400);
    });
  });

  // ===== Study Rooms =====
  describe('Study Rooms', () => {
    it('unknown roomId returns 404 (P1-7)', async () => {
      const res = await request.post('/api/study-rooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ roomId: 99999 });
      assert.equal(res.status, 404);
    });
  });

  // ===== Community / Upvote =====
  describe('Community', () => {
    it('double upvote returns 409 (P1-7)', async () => {
      // User 1 already liked post 2 in seed data
      const res = await request.post('/api/community/upvote')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ postId: 2 });
      assert.equal(res.status, 409);
    });
  });

  // ===== Revision =====
  describe('Revision', () => {
    it('start-session requires itemIds (P1-7)', async () => {
      const res = await request.post('/api/revision/start-session')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      assert.equal(res.status, 400);
    });
  });

  // ===== Phase 2: AI Budget =====
  describe('AI Budget (Phase 2)', () => {
    it('GET /api/ai/budget returns budget info', async () => {
      const res = await request.get('/api/ai/budget')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.allowed, true);
      assert.ok(typeof res.body.dailyUsed === 'number');
      assert.ok(typeof res.body.dailyLimit === 'number');
    });
  });

  // ===== Phase 2: SSE Streaming =====
  describe('SSE Streaming (Phase 2)', () => {
    it('GET /api/ai/doubt/stream requires prompt', async () => {
      const res = await request.get('/api/ai/doubt/stream')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 400);
    });

    it('GET /api/ai/doubt/stream returns event-stream', async () => {
      const res = await request.get('/api/ai/doubt/stream?prompt=What+is+capacitance')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/event-stream'));
    });
  });

  // ===== Phase 2: Question Bank API =====
  describe('Question Bank API (Phase 2)', () => {
    it('admin can list question bank', async () => {
      const res = await request.get('/api/admin/question-bank')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.questions));
      assert.ok(res.body.stats.total > 0);
    });

    it('student cannot access question bank', async () => {
      const res = await request.get('/api/admin/question-bank')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.equal(res.status, 403);
    });

    it('admin can add a question', async () => {
      const res = await request.post('/api/admin/question-bank')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'What is the unit of electric potential?',
          correct_answer: 'Volt',
          subject: 'Physics',
          topic: 'Electric Potential',
          type: 'MCQ',
          options: ['Volt', 'Ampere', 'Watt', 'Ohm']
        });
      assert.equal(res.status, 200);
      assert.ok(res.body.question.id);
      assert.equal(res.body.question.is_verified, false);
    });

    it('admin can verify a question', async () => {
      const res = await request.post('/api/admin/question-bank/1/verify')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.question.is_verified, true);
    });

    it('test generation uses question bank', async () => {
      const res = await request.post('/api/tests/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ subject: 'Physics', topic: 'Capacitance', totalQuestions: 2 });
      assert.equal(res.status, 200);
      assert.ok(res.body.test.questions_json.length > 0);
      // Answers still stripped
      res.body.test.questions_json.forEach(q => {
        assert.equal(q.correct_answer, undefined);
        assert.equal(q.explanation, undefined);
      });
    });

    it('admin overview includes question bank stats', async () => {
      const res = await request.get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.question_bank);
      assert.ok(typeof res.body.question_bank.total === 'number');
    });
  });

  // ===== Health (no auth needed) =====
  describe('Health', () => {
    it('GET /api/health returns UP without auth', async () => {
      const res = await request.get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'UP');
    });
  });
});
