// ---------------------------------------------------------------------------
// Question Bank — Phase 2
// ---------------------------------------------------------------------------
// Replaces the hardcoded 5-question array in aiService.generateTest().
// Questions are stored in the DB, tagged by subject/topic/difficulty/exam.
// Test generation pulls random subsets; AI can generate variations later.
// ---------------------------------------------------------------------------

const { db, saveDB } = require('./db');

/**
 * Get questions matching filters. Returns a random subset of `count`.
 */
function getQuestions({ subject, topic, difficulty, exam, count = 5 } = {}) {
  let pool = db.question_bank || [];

  if (subject) pool = pool.filter(q => q.subject.toLowerCase() === subject.toLowerCase());
  if (topic) pool = pool.filter(q => q.topic.toLowerCase() === topic.toLowerCase());
  if (difficulty) pool = pool.filter(q => q.difficulty.toLowerCase() === difficulty.toLowerCase());
  if (exam) pool = pool.filter(q => q.exam.toLowerCase() === exam.toLowerCase());

  // Fisher-Yates shuffle then take `count`
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Add a question to the bank. Returns the created question.
 */
function addQuestion({ question, type = 'MCQ', options, correct_answer, explanation, subject, topic, difficulty = 'Medium', exam = 'JEE Main', tags = [] }) {
  if (!question || !correct_answer || !subject || !topic) {
    throw new Error('question, correct_answer, subject, and topic are required');
  }

  const newId = (db.question_bank || []).length
    ? Math.max(...db.question_bank.map(q => q.id || 0)) + 1
    : 1;

  const entry = {
    id: newId,
    question,
    type,
    options: options || [],
    correct_answer,
    explanation: explanation || '',
    subject,
    topic,
    difficulty,
    exam,
    tags,
    is_verified: false,
    created_at: new Date().toISOString()
  };

  db.question_bank.push(entry);
  saveDB();
  return entry;
}

/**
 * Bulk-add questions (for seeding or admin import).
 */
function addQuestions(questions) {
  return questions.map(q => addQuestion(q));
}

/**
 * Mark a question as verified (reviewed by a teacher/admin).
 */
function verifyQuestion(questionId) {
  const q = db.question_bank.find(q => q.id === questionId);
  if (!q) return null;
  q.is_verified = true;
  saveDB();
  return q;
}

/**
 * Get bank stats (for admin dashboard).
 */
function getStats() {
  const bank = db.question_bank || [];
  const bySubject = {};
  const byDifficulty = {};

  bank.forEach(q => {
    bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
  });

  return {
    total: bank.length,
    verified: bank.filter(q => q.is_verified).length,
    bySubject,
    byDifficulty
  };
}

/**
 * Build a test from the question bank. Falls back to the original
 * hardcoded questions if the bank is empty for the given filters.
 */
function generateTestFromBank({ subject, topic, difficulty, totalQuestions = 5, exam = 'JEE Main' }) {
  const questions = getQuestions({ subject, topic, difficulty, exam, count: totalQuestions });

  const title = `${exam} ${subject || 'Mixed'} (${topic || 'Mixed Topics'}) Assessment`;

  return {
    title,
    subject: subject || 'Physics',
    topic: topic || 'Mixed Topics',
    difficulty: difficulty || 'Medium',
    total_questions: questions.length,
    time_limit_mins: Math.max(5, questions.length * 3),
    questions,
    from_bank: true,
    bank_count: questions.length
  };
}

module.exports = {
  getQuestions,
  addQuestion,
  addQuestions,
  verifyQuestion,
  getStats,
  generateTestFromBank
};
