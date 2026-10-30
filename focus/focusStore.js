/**
 * FocusLearn Store (focusStore.js)
 * Isolated atomic file persistence for FocusLearn user data.
 * File location: data/focus.json
 * Written atomically (temp file + rename). Does not touch db.js.
 */

const fs = require('fs');
const path = require('path');

let DATA_FILE = path.join(__dirname, '..', 'data', 'focus.json');

function setDataFilePath(customPath) {
  DATA_FILE = customPath;
}

function getDataFilePath() {
  return DATA_FILE;
}

function getDefaultUserState() {
  return {
    domain: 'Physics',
    locked: false,
    secs: 0,
    v: [], // { id, title, domain, tags: [], tr: "", w: boolean }
    q: [], // { id, s, n, hit: [], miss: [], at: number }
    pendingQuizzes: {} // { [quizId]: { videoId, questions, createdAt } }
  };
}

/**
 * Safely reads the database file with fallback for empty or corrupted files
 */
function readStorage() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {} };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw || !raw.trim()) {
      return { users: {} };
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.users) {
      return { users: {} };
    }
    return data;
  } catch (err) {
    console.warn(`[FocusStore] Corrupted or unreadable focus.json encountered: ${err.message}. Initializing clean state.`);
    try {
      if (fs.existsSync(DATA_FILE)) {
        const backupPath = `${DATA_FILE}.corrupt.${Date.now()}`;
        fs.renameSync(DATA_FILE, backupPath);
      }
    } catch (_) {}
    return { users: {} };
  }
}

/**
 * Writes data atomically to disk: temp file + rename
 */
function writeStorage(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${DATA_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const jsonString = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, jsonString, 'utf8');

  try {
    fs.renameSync(tmpPath, DATA_FILE);
  } catch (renameErr) {
    // Windows file locking fallback
    try {
      fs.copyFileSync(tmpPath, DATA_FILE);
      fs.unlinkSync(tmpPath);
    } catch (copyErr) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      throw new Error(`Failed atomic write to focus store: ${renameErr.message}`);
    }
  }
}

/**
 * Retrieves the focus state for a specific user
 */
function getUserFocusData(userId) {
  if (!userId) throw new Error('userId is required');
  const store = readStorage();
  const userKey = String(userId);
  if (!store.users[userKey]) {
    return getDefaultUserState();
  }
  const u = store.users[userKey];
  return {
    domain: u.domain || 'Physics',
    locked: Boolean(u.locked),
    secs: typeof u.secs === 'number' ? Math.max(0, u.secs) : 0,
    v: Array.isArray(u.v) ? u.v : [],
    q: Array.isArray(u.q) ? u.q : [],
    pendingQuizzes: u.pendingQuizzes && typeof u.pendingQuizzes === 'object' ? u.pendingQuizzes : {}
  };
}

/**
 * Atomic mutation helper
 */
function mutateUserFocusData(userId, mutator) {
  if (!userId) throw new Error('userId is required');
  const store = readStorage();
  const userKey = String(userId);
  if (!store.users[userKey]) {
    store.users[userKey] = getDefaultUserState();
  }
  if (!store.users[userKey].pendingQuizzes) {
    store.users[userKey].pendingQuizzes = {};
  }
  const result = mutator(store.users[userKey]);
  writeStorage(store);
  return result !== undefined ? result : store.users[userKey];
}

/**
 * Update user settings (domain, lock, secs)
 */
function updateSettings(userId, { domain, locked, secs }) {
  return mutateUserFocusData(userId, state => {
    if (typeof domain === 'string' && domain.trim()) {
      state.domain = domain.trim();
    }
    if (typeof locked === 'boolean') {
      state.locked = locked;
    }
    if (typeof secs === 'number' && !isNaN(secs) && secs >= 0) {
      state.secs = Math.floor(secs);
    }
    return state;
  });
}

/**
 * Add a video to user's feed
 */
function addVideo(userId, video) {
  return mutateUserFocusData(userId, state => {
    const videoDomain = (video.domain || state.domain || 'Physics').trim();

    // Enforce domain lock check: if locked and domain differs
    if (state.locked && videoDomain.toLowerCase() !== state.domain.toLowerCase()) {
      const err = new Error(`Feed is locked to ${state.domain}. Unlock feed to add lessons from other domains.`);
      err.statusCode = 400;
      throw err;
    }

    // Check for duplicate video ID
    const existing = state.v.find(item => item.id === video.id);
    if (existing) {
      const err = new Error(`Video with ID "${video.id}" is already in your feed.`);
      err.statusCode = 409;
      throw err;
    }

    const newVideo = {
      id: video.id,
      title: (video.title || 'Untitled Lesson').trim(),
      domain: videoDomain,
      tags: Array.isArray(video.tags) ? video.tags.map(t => String(t).trim()).filter(Boolean) : [],
      tr: typeof video.tr === 'string' ? video.tr : '',
      w: Boolean(video.w)
    };

    state.v.push(newVideo);
    return newVideo;
  });
}

/**
 * Update an existing video
 */
function updateVideo(userId, videoId, updates) {
  return mutateUserFocusData(userId, state => {
    const idx = state.v.findIndex(item => item.id === videoId);
    if (idx === -1) {
      const err = new Error(`Lesson with ID "${videoId}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const current = state.v[idx];
    if (typeof updates.title === 'string' && updates.title.trim()) {
      current.title = updates.title.trim();
    }
    if (typeof updates.domain === 'string' && updates.domain.trim()) {
      current.domain = updates.domain.trim();
    }
    if (Array.isArray(updates.tags)) {
      current.tags = updates.tags.map(t => String(t).trim()).filter(Boolean);
    }
    if (typeof updates.tr === 'string') {
      current.tr = updates.tr;
    }
    if (typeof updates.w === 'boolean') {
      current.w = updates.w;
    }

    return current;
  });
}

/**
 * Delete a video from feed
 */
function deleteVideo(userId, videoId) {
  return mutateUserFocusData(userId, state => {
    const initialLen = state.v.length;
    state.v = state.v.filter(item => item.id !== videoId);
    if (state.v.length === initialLen) {
      const err = new Error(`Lesson with ID "${videoId}" not found.`);
      err.statusCode = 404;
      throw err;
    }
    return { deleted: true, id: videoId };
  });
}

/**
 * Records a quiz attempt
 */
function addQuizAttempt(userId, attempt) {
  return mutateUserFocusData(userId, state => {
    const record = {
      id: attempt.id,
      s: attempt.s,
      n: attempt.n || 5,
      hit: Array.isArray(attempt.hit) ? attempt.hit : [],
      miss: Array.isArray(attempt.miss) ? attempt.miss : [],
      at: typeof attempt.at === 'number' ? attempt.at : Date.now()
    };
    state.q.push(record);
    return record;
  });
}

/**
 * Store a pending quiz (with answers) on the server
 */
function storePendingQuiz(userId, videoId, questions) {
  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  mutateUserFocusData(userId, state => {
    state.pendingQuizzes[quizId] = {
      videoId,
      questions,
      createdAt: Date.now()
    };
  });
  return quizId;
}

/**
 * Retrieves a pending quiz
 */
function getPendingQuiz(userId, quizId) {
  const state = getUserFocusData(userId);
  return state.pendingQuizzes?.[quizId] || null;
}

/**
 * Removes a pending quiz after submission
 */
function removePendingQuiz(userId, quizId) {
  return mutateUserFocusData(userId, state => {
    if (state.pendingQuizzes && state.pendingQuizzes[quizId]) {
      delete state.pendingQuizzes[quizId];
    }
  });
}

/**
 * Updates study timer
 */
function updateTimer(userId, seconds) {
  return mutateUserFocusData(userId, state => {
    state.secs = Math.max(0, Math.floor(seconds));
    return state;
  });
}

module.exports = {
  setDataFilePath,
  getDataFilePath,
  getDefaultUserState,
  readStorage,
  writeStorage,
  getUserFocusData,
  mutateUserFocusData,
  updateSettings,
  addVideo,
  updateVideo,
  deleteVideo,
  addQuizAttempt,
  storePendingQuiz,
  getPendingQuiz,
  removePendingQuiz,
  updateTimer
};
