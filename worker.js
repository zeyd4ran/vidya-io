#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Worker Process — Phase 3
// ---------------------------------------------------------------------------
// Runs as a SEPARATE deployable from the API server.
// Polls the DB for pending jobs and processes them using registered handlers.
//
// Usage:
//   node worker.js                     # start worker
//   JOB_POLL_MS=5000 node worker.js    # custom poll interval
//
// The API server (server.js) only enqueues jobs — this process does the work.
// Heavy jobs here cannot starve the API event loop.
// ---------------------------------------------------------------------------

const dotenv = require('dotenv');
dotenv.config();

// Ensure JWT_SECRET is available (db.js may need it indirectly)
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required.');
  process.exit(1);
}

const { startWorker, stopWorker, registerHandler, updateJobProgress } = require('./jobQueue');
const aiService = require('./aiService');
const { indexDocument } = require('./ragEngine');

// ---------------------------------------------------------------------------
// Register heavyweight job handlers
// (These are the same as in jobQueue.js built-ins, but you can override
//  or add new ones here for production workloads.)
// ---------------------------------------------------------------------------

// Video processing with real AI integration
registerHandler('VIDEO_PROCESSING', async (payload, jobId) => {
  const { videoUrl, videoTitle, subject, topic, userId } = payload;

  updateJobProgress(jobId, 10);

  // Process video content through AI service
  const result = await aiService.processVideoContent({
    videoUrl,
    videoTitle: videoTitle || 'Educational Video',
    subject: subject || 'Physics',
    topic: topic || 'General'
  });

  updateJobProgress(jobId, 60);

  // Index generated notes into RAG engine
  if (result.notes_markdown && userId) {
    indexDocument({
      docId: `vid_${jobId}`,
      title: result.title,
      content: result.notes_markdown,
      type: 'video_notes',
      subject: subject || 'Physics',
      userId
    });
  }

  updateJobProgress(jobId, 90);

  return {
    title: result.title,
    notes_generated: true,
    flashcards_count: result.flashcards_json?.length || 0,
    quiz_count: result.quiz_json?.length || 0,
    mindmap_generated: !!result.mindmap_json
  };
});

// Document parsing and RAG indexing
registerHandler('DOCUMENT_PARSE', async (payload, jobId) => {
  const { docId, title, content, subject, userId } = payload;

  updateJobProgress(jobId, 30);

  // Index into RAG engine
  if (content && userId) {
    indexDocument({ docId, title, content, subject, userId });
  }

  updateJobProgress(jobId, 80);

  return {
    docId,
    indexed: true,
    contentLength: (content || '').length
  };
});

// Bulk test generation
registerHandler('BULK_TEST_GENERATION', async (payload, jobId) => {
  const { subjects, questionsPerSubject, difficulty } = payload;

  const results = [];
  const total = (subjects || ['Physics']).length;
  let done = 0;

  for (const subject of (subjects || ['Physics'])) {
    const test = await aiService.generateTest({
      subject,
      totalQuestions: questionsPerSubject || 10,
      difficulty: difficulty || 'Medium'
    });
    results.push({ subject, questionCount: test.questions.length });
    done++;
    updateJobProgress(jobId, Math.round((done / total) * 90));
  }

  return { testsGenerated: results.length, results };
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal) {
  console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`);
  stopWorker();

  // Flush DB
  try {
    const { flushDB } = require('./db');
    flushDB();
  } catch { /* ignore */ }

  console.log('[Worker] Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log('====================================================');
console.log('🔧 VIDYA AI Worker Process');
console.log(`   Poll interval: ${process.env.JOB_POLL_MS || 3000}ms`);
console.log(`   Max retries: ${process.env.JOB_MAX_RETRIES || 3}`);
console.log('====================================================');

startWorker();
