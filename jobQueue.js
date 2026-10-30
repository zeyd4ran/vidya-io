// ---------------------------------------------------------------------------
// Job Queue — Phase 3: Durable Background Work
// ---------------------------------------------------------------------------
// DB-persisted jobs with proper state machine, retries with backoff,
// dead-letter queue, idempotent handlers, and WebSocket notifications.
//
// Replaces the in-memory Map from P1. Ready for BullMQ/Redis migration
// when Phase 1 Postgres + Phase 3 Redis are in place.
// ---------------------------------------------------------------------------

const { randomUUID } = require('crypto');
const { db, saveDB } = require('./db');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MAX_RETRIES = parseInt(process.env.JOB_MAX_RETRIES || '3', 10);
const BACKOFF_BASE_MS = 2000;                 // 2s, 4s, 8s...
const POLL_INTERVAL_MS = parseInt(process.env.JOB_POLL_MS || '3000', 10);
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || '120000', 10); // 2 min
const STALE_JOB_MS = 5 * 60 * 1000;          // 5 min — reclaim stuck active jobs

// ---------------------------------------------------------------------------
// Job States
// ---------------------------------------------------------------------------
//  pending → active → completed
//                   → failed → (retry) → pending
//                            → dead_letter (max retries exceeded)
const STATES = {
  PENDING:     'pending',
  ACTIVE:      'active',
  COMPLETED:   'completed',
  FAILED:      'failed',
  DEAD_LETTER: 'dead_letter'
};

// ---------------------------------------------------------------------------
// Registered job handlers (keyed by job type)
// ---------------------------------------------------------------------------
const _handlers = {};

/**
 * Register a handler for a job type.
 * handler(payload) → Promise<result>
 * Must be idempotent — may be called more than once for the same job.
 */
function registerHandler(type, handler) {
  _handlers[type] = handler;
}

// ---------------------------------------------------------------------------
// Idempotency tracking
// ---------------------------------------------------------------------------
const _processedKeys = new Set();

function _idempotencyKey(job) {
  return `${job.type}:${job.idempotency_key || job.id}`;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Enqueue a new job. Returns the persisted job record.
 */
function createJob(type, payload, userId = null, { idempotencyKey = null, priority = 0 } = {}) {
  const jobId = `job_${randomUUID()}`;

  // Idempotency guard — if the same key was already enqueued, return existing
  if (idempotencyKey) {
    const existing = db.processing_jobs.find(j =>
      j.type === type && j.idempotency_key === idempotencyKey && j.status !== STATES.DEAD_LETTER
    );
    if (existing) return existing;
  }

  const job = {
    id: jobId,
    type,
    payload,
    user_id: userId,
    idempotency_key: idempotencyKey,
    priority,
    status: STATES.PENDING,
    progress: 0,
    attempt: 0,
    max_retries: MAX_RETRIES,
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    next_retry_at: null
  };

  db.processing_jobs.push(job);
  saveDB();
  return job;
}

/**
 * Get a job by ID.
 */
function getJobStatus(jobId) {
  return db.processing_jobs.find(j => j.id === jobId) || null;
}

/**
 * Update job progress (0–100). Called by handlers during processing.
 */
function updateJobProgress(jobId, progress, partialResult = null) {
  const job = db.processing_jobs.find(j => j.id === jobId);
  if (!job) return null;

  job.progress = Math.min(100, Math.max(0, progress));
  job.updated_at = new Date().toISOString();
  if (partialResult) job.result = partialResult;
  saveDB();
  return job;
}

/**
 * List jobs for a user, with optional status filter.
 */
function listJobs(userId, { status, limit = 20, offset = 0 } = {}) {
  let results = db.processing_jobs.filter(j => j.user_id === userId);
  if (status) results = results.filter(j => j.status === status);
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    jobs: results.slice(offset, offset + limit),
    total: results.length
  };
}

/**
 * Get dead-letter queue (admin use).
 */
function getDeadLetterQueue() {
  return db.processing_jobs.filter(j => j.status === STATES.DEAD_LETTER);
}

/**
 * Retry a dead-letter job (admin action).
 */
function retryDeadLetter(jobId) {
  const job = db.processing_jobs.find(j => j.id === jobId && j.status === STATES.DEAD_LETTER);
  if (!job) return null;
  job.status = STATES.PENDING;
  job.attempt = 0;
  job.error = null;
  job.next_retry_at = null;
  job.updated_at = new Date().toISOString();
  _processedKeys.delete(_idempotencyKey(job));
  saveDB();
  return job;
}

// ---------------------------------------------------------------------------
// Worker: polls and processes jobs
// ---------------------------------------------------------------------------

let _workerTimer = null;
let _notifyCallback = null;    // Set by server.js to broadcast via WebSocket

/**
 * Set a callback to notify when a job completes/fails.
 * callback(job) — called with the updated job record.
 */
function onJobComplete(callback) {
  _notifyCallback = callback;
}

/**
 * Claim the next pending job (oldest first, respecting priority & retry delay).
 */
function _claimNextJob() {
  const now = new Date();

  // Reclaim stale active jobs (stuck handlers)
  db.processing_jobs.forEach(j => {
    if (j.status === STATES.ACTIVE && j.started_at) {
      const elapsed = now - new Date(j.started_at);
      if (elapsed > STALE_JOB_MS) {
        console.warn(`[JobQueue] Reclaiming stale job ${j.id} (active for ${Math.round(elapsed / 1000)}s)`);
        j.status = STATES.FAILED;
        j.error = 'Job timed out (stale)';
        j.updated_at = now.toISOString();
      }
    }
  });

  // Find the next claimable job
  const candidates = db.processing_jobs
    .filter(j => {
      if (j.status !== STATES.PENDING) return false;
      if (j.next_retry_at && new Date(j.next_retry_at) > now) return false;
      return true;
    })
    .sort((a, b) => {
      // Higher priority first, then older first
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.created_at) - new Date(b.created_at);
    });

  if (candidates.length === 0) return null;

  const job = candidates[0];
  job.status = STATES.ACTIVE;
  job.attempt += 1;
  job.started_at = now.toISOString();
  job.updated_at = now.toISOString();
  saveDB();
  return job;
}

/**
 * Process a single job.
 */
async function _processJob(job) {
  const handler = _handlers[job.type];

  if (!handler) {
    job.status = STATES.DEAD_LETTER;
    job.error = `No handler registered for job type: ${job.type}`;
    job.updated_at = new Date().toISOString();
    saveDB();
    console.error(`[JobQueue] No handler for type "${job.type}", sent to dead-letter`);
    return;
  }

  // Idempotency check — skip if already processed
  const idemKey = _idempotencyKey(job);
  if (_processedKeys.has(idemKey) && job.status === STATES.ACTIVE) {
    job.status = STATES.COMPLETED;
    job.progress = 100;
    job.updated_at = new Date().toISOString();
    saveDB();
    return;
  }

  try {
    // Run with a timeout
    const result = await Promise.race([
      handler(job.payload, job.id),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job handler timed out')), JOB_TIMEOUT_MS)
      )
    ]);

    job.status = STATES.COMPLETED;
    job.progress = 100;
    job.result = result;
    job.completed_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
    _processedKeys.add(idemKey);
    saveDB();

    if (_notifyCallback) _notifyCallback(job);
  } catch (err) {
    console.error(`[JobQueue] Job ${job.id} failed (attempt ${job.attempt}/${job.max_retries}):`, err.message);

    if (job.attempt >= job.max_retries) {
      job.status = STATES.DEAD_LETTER;
      job.error = `Max retries exceeded. Last error: ${err.message}`;
      job.updated_at = new Date().toISOString();
      saveDB();
      console.error(`[JobQueue] Job ${job.id} sent to dead-letter queue`);
    } else {
      // Exponential backoff
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, job.attempt - 1);
      job.status = STATES.PENDING;
      job.error = err.message;
      job.next_retry_at = new Date(Date.now() + backoffMs).toISOString();
      job.updated_at = new Date().toISOString();
      saveDB();
    }

    if (_notifyCallback) _notifyCallback(job);
  }
}

/**
 * Poll loop — process one job per tick.
 */
async function _pollOnce() {
  const job = _claimNextJob();
  if (job) {
    await _processJob(job);
  }
}

/**
 * Start the worker loop. Call once from the API server or a separate worker process.
 */
function startWorker() {
  if (_workerTimer) return; // Already running
  console.log(`[JobQueue] Worker started (poll every ${POLL_INTERVAL_MS}ms)`);

  async function tick() {
    try {
      await _pollOnce();
    } catch (err) {
      console.error('[JobQueue] Worker tick error:', err.message);
    }
    _workerTimer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  tick();
}

/**
 * Stop the worker loop.
 */
function stopWorker() {
  if (_workerTimer) {
    clearTimeout(_workerTimer);
    _workerTimer = null;
    console.log('[JobQueue] Worker stopped');
  }
}

// ---------------------------------------------------------------------------
// Built-in handlers (register default task processors)
// ---------------------------------------------------------------------------

// VIDEO_PROCESSING — simulates video analysis (replace with real impl)
registerHandler('VIDEO_PROCESSING', async (payload, jobId) => {
  // Simulate multi-step processing
  updateJobProgress(jobId, 20);
  await new Promise(r => setTimeout(r, 500));

  updateJobProgress(jobId, 60);
  await new Promise(r => setTimeout(r, 500));

  updateJobProgress(jobId, 90);
  await new Promise(r => setTimeout(r, 300));

  return {
    summary: 'Video processed successfully',
    chapters: 4,
    notesGenerated: true,
    videoUrl: payload.videoUrl
  };
});

// DOCUMENT_PARSE — simulates document ingestion
registerHandler('DOCUMENT_PARSE', async (payload, jobId) => {
  updateJobProgress(jobId, 30);
  await new Promise(r => setTimeout(r, 400));

  updateJobProgress(jobId, 70);
  await new Promise(r => setTimeout(r, 300));

  return {
    pages: payload.pageCount || 10,
    chunks: Math.ceil((payload.pageCount || 10) * 3),
    indexed: true,
    docId: payload.docId
  };
});

// REPORT_GENERATION — simulates generating a study report
registerHandler('REPORT_GENERATION', async (payload, jobId) => {
  updateJobProgress(jobId, 50);
  await new Promise(r => setTimeout(r, 600));

  return {
    reportType: payload.reportType || 'weekly',
    sections: ['performance', 'weak_areas', 'recommendations'],
    generated: true
  };
});

// TEST — lightweight handler for testing
registerHandler('TEST', async (payload) => {
  return { tested: true, payload };
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  // Core API
  createJob,
  getJobStatus,
  updateJobProgress,
  listJobs,

  // Worker
  startWorker,
  stopWorker,
  registerHandler,
  onJobComplete,

  // Admin
  getDeadLetterQueue,
  retryDeadLetter,

  // Backward compat (used in server.js)
  processVideoJob: (jobId, videoUrl) => {
    // No-op — the worker picks up the job automatically now
  },

  // Constants for testing
  STATES,
  _pollOnce
};
