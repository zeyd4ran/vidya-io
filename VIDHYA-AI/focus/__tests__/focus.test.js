/**
 * FocusLearn Automated Test Suite (focus.test.js)
 * Covers:
 * - 401 without token
 * - user A cannot read or change user B's data
 * - locked-domain rejection
 * - generate response contains no answers (server keeps answers)
 * - grading (server grades and returns explanations)
 * - gap flagging (accuracy < 0.70)
 * - normaliser ("Newton's Laws" and "newtons laws" merge)
 * - next-lesson ranking (unwatched video targeting weak concept ranked highest)
 * - AI failure returns a clean error
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const logic = require('../focusLogic');
const store = require('../focusStore');
const ai = require('../focusAI');
const focusRoutes = require('../focusRoutes');

const TEST_SECRET = 'focus_learn_test_secret_key_123';
process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_SECRET;

const TEST_STORE_PATH = path.join(__dirname, 'test-focus-data.json');

function createToken(userId, role = 'student') {
  return jwt.sign({ id: userId, email: `user_${userId}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('FocusLearn Backend Module', () => {

  before(() => {
    store.setDataFilePath(TEST_STORE_PATH);
  });

  after(() => {
    try {
      if (fs.existsSync(TEST_STORE_PATH)) fs.unlinkSync(TEST_STORE_PATH);
    } catch (_) {}
  });

  beforeEach(() => {
    try {
      if (fs.existsSync(TEST_STORE_PATH)) fs.unlinkSync(TEST_STORE_PATH);
    } catch (_) {}
  });

  // ----------------------------------------------------
  // 1. CONCEPT NORMALISER TEST
  // ----------------------------------------------------
  describe('Concept Normaliser', () => {
    it('normaliser merges near-duplicates ("Newton\'s Laws" and "newtons laws")', () => {
      const v1 = logic.normalizeConcept("Newton's Laws");
      const v2 = logic.normalizeConcept("newtons laws");
      const v3 = logic.normalizeConcept("  NEWTONS   LAWS!  ");

      assert.equal(v1, 'newtons laws');
      assert.equal(v2, 'newtons laws');
      assert.equal(v3, 'newtons laws');
      assert.equal(v1, v2);
      assert.equal(v2, v3);
    });

    it('computeConceptAccuracy merges hit and miss for punctuated names', () => {
      const attempts = [
        { hit: ["Newton's Laws"], miss: [] },
        { hit: [], miss: ["newtons laws!"] }
      ];
      const stats = logic.computeConceptAccuracy(attempts);
      assert.equal(stats.length, 1);
      assert.equal(stats[0].concept, 'newtons laws');
      assert.equal(stats[0].total, 2);
      assert.equal(stats[0].hit, 1);
      assert.equal(stats[0].miss, 1);
      assert.equal(stats[0].accuracy, 0.5);
    });
  });

  // ----------------------------------------------------
  // 2. GAP FLAGGING TEST
  // ----------------------------------------------------
  describe('Gap Flagging', () => {
    it('accurately flags concepts below 70% (0.70) accuracy as gaps', () => {
      const attempts = [
        // 'friction': 1 hit, 1 miss -> 50% (< 70% -> gap!)
        { hit: ['friction'], miss: ['friction'] },
        // 'calculus': 4 hit, 1 miss -> 80% (>= 70% -> not gap)
        { hit: ['calculus', 'calculus', 'calculus', 'calculus'], miss: ['calculus'] },
        // 'optics': 0 hit, 2 miss -> 0% (< 70% -> gap!)
        { hit: [], miss: ['optics', 'optics'] }
      ];

      const concepts = logic.computeConceptAccuracy(attempts);

      const friction = concepts.find(c => c.concept === 'friction');
      const calculus = concepts.find(c => c.concept === 'calculus');
      const optics = concepts.find(c => c.concept === 'optics');

      assert.equal(friction.isGap, true);
      assert.equal(friction.accuracy, 0.5);

      assert.equal(calculus.isGap, false);
      assert.equal(calculus.accuracy, 0.8);

      assert.equal(optics.isGap, true);
      assert.equal(optics.accuracy, 0);

      // Weakest concept must come first
      assert.equal(concepts[0].concept, 'optics');
    });
  });

  // ----------------------------------------------------
  // 3. NEXT-LESSON RANKING TEST
  // ----------------------------------------------------
  describe('Next-Lesson Ranking', () => {
    it('next-lesson ranking prefers unwatched lesson matching weak concepts with highest weight', () => {
      const videos = [
        {
          id: 'v_watched',
          title: 'Friction and Motion',
          domain: 'Physics',
          tags: ['friction'],
          tr: 'Friction intro',
          w: true
        },
        {
          id: 'v_gravity',
          title: 'Planetary Orbits',
          domain: 'Physics',
          tags: ['orbits'],
          tr: 'Kepler laws',
          w: false
        },
        {
          id: 'v_friction',
          title: 'Deep Dive into Friction Forces',
          domain: 'Physics',
          tags: ['friction', 'drag'],
          tr: 'Detailed review of kinetic friction coefficient and normal force.',
          w: false
        }
      ];

      // Student has severe gap in friction (0% accuracy)
      const quizAttempts = [
        { hit: [], miss: ['friction', 'friction'] }
      ];

      const next = logic.calculateNextLesson(videos, quizAttempts, 'Physics');
      assert.ok(next);
      assert.equal(next.lesson.id, 'v_friction');
      assert.equal(next.allWatched, false);
      assert.ok(next.reason.includes('friction'));
    });
  });

  // ----------------------------------------------------
  // 4. ROUTE INTEGRATION & AUTH TESTS
  // ----------------------------------------------------
  describe('focusRoutes HTTP Endpoints', () => {
    let app;
    const userA = 'user_alice';
    const userB = 'user_bob';
    let tokenA;
    let tokenB;

    before(() => {
      app = express();
      app.use('/api/focus', focusRoutes);
      tokenA = createToken(userA);
      tokenB = createToken(userB);
    });

    it('rejects request with 401 without token', async () => {
      const res = await request(app).get('/api/focus/videos');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Authentication required');
    });

    it('user A cannot read or change user B data', async () => {
      // User A adds a video
      const addRes = await request(app)
        .post('/api/focus/videos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          urlOrId: 'dQw4w9WgXcQ',
          title: "Alice's Secret Video",
          domain: 'Physics'
        });
      assert.equal(addRes.status, 201);

      // User B lists videos -> Alice's video must NOT appear
      const bList = await request(app)
        .get('/api/focus/videos')
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(bList.status, 200);
      assert.equal(bList.body.videos.length, 0);

      // User B tries to delete Alice's video -> returns 404
      const bDelete = await request(app)
        .delete('/api/focus/videos/dQw4w9WgXcQ')
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(bDelete.status, 404);

      // User A's video is still intact
      const aList = await request(app)
        .get('/api/focus/videos')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(aList.body.videos.length, 1);
      assert.equal(aList.body.videos[0].title, "Alice's Secret Video");
    });

    it('locked-domain rejection blocks adding videos outside current domain', async () => {
      // Lock User A to Maths
      await request(app)
        .put('/api/focus/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ domain: 'Maths', locked: true });

      // Try adding Physics video -> 400
      const res = await request(app)
        .post('/api/focus/videos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          urlOrId: 'aircAruvnKk',
          title: 'Quantum Field Theory',
          domain: 'Physics'
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('Feed is locked to Maths'));
    });

    it('generate response contains no answers and server keeps them', async () => {
      // Mock generateQuizQuestions to return controlled 5 questions
      const origGenerate = ai.generateQuizQuestions;
      ai.generateQuizQuestions = async () => [
        { q: 'Q1?', options: ['A', 'B', 'C', 'D'], answer: 0, concept: 'concept1', explanation: 'Exp 1' },
        { q: 'Q2?', options: ['A', 'B', 'C', 'D'], answer: 1, concept: 'concept2', explanation: 'Exp 2' },
        { q: 'Q3?', options: ['A', 'B', 'C', 'D'], answer: 2, concept: 'concept3', explanation: 'Exp 3' },
        { q: 'Q4?', options: ['A', 'B', 'C', 'D'], answer: 3, concept: 'concept4', explanation: 'Exp 4' },
        { q: 'Q5?', options: ['A', 'B', 'C', 'D'], answer: 0, concept: 'concept5', explanation: 'Exp 5' }
      ];

      const genRes = await request(app)
        .post('/api/focus/quiz/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ videoId: 'dQw4w9WgXcQ' });

      assert.equal(genRes.status, 200);
      assert.ok(genRes.body.quizId);
      assert.equal(genRes.body.questions.length, 5);

      // Verify NO answers or explanations leaked to the client
      genRes.body.questions.forEach((q, idx) => {
        assert.equal(q.answer, undefined, `Question ${idx} must not contain answer`);
        assert.equal(q.explanation, undefined, `Question ${idx} must not contain explanation`);
        assert.ok(q.q);
        assert.equal(q.options.length, 4);
      });

      // ----------------------------------------------------
      // 5. SERVER GRADING TEST
      // ----------------------------------------------------
      // Submit: Question 0 chosen 0 (correct), Question 1 chosen 2 (wrong), others omitted (wrong)
      const subRes = await request(app)
        .post('/api/focus/quiz/submit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          quizId: genRes.body.quizId,
          answers: { 0: 0, 1: 2 } // 1 correct, 4 wrong
        });

      assert.equal(subRes.status, 200);
      assert.equal(subRes.body.score, 1);
      assert.equal(subRes.body.total, 5);
      assert.equal(subRes.body.results.length, 5);

      // Results must now reveal explanations and correct answers
      assert.equal(subRes.body.results[0].isCorrect, true);
      assert.equal(subRes.body.results[0].correctAnswer, 0);
      assert.equal(subRes.body.results[0].explanation, 'Exp 1');

      assert.equal(subRes.body.results[1].isCorrect, false);
      assert.equal(subRes.body.results[1].correctAnswer, 1);

      // Hit and miss concepts
      assert.deepEqual(subRes.body.hitConcepts, ['concept1']);
      assert.ok(subRes.body.missConcepts.includes('concept2'));

      // Clean up mock
      ai.generateQuizQuestions = origGenerate;
    });

    it('AI failure returns a clean error (never fake data)', async () => {
      const origAnswer = ai.answerSnapshotQuestion;
      ai.answerSnapshotQuestion = async () => {
        const err = new Error('Gemini API call failed: Request timed out after 20s');
        err.statusCode = 503;
        throw err;
      };

      const res = await request(app)
        .post('/api/focus/ask')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ question: 'What is entropy?' });

      assert.equal(res.status, 503);
      assert.ok(res.body.error.includes('timed out') || res.body.error.includes('Gemini API'));

      // Restore mock
      ai.answerSnapshotQuestion = origAnswer;
    });
  });
});
