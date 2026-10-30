/**
 * FocusLearn Pure Business Logic
 * pure functions for video learning, concept normalization, gap detection, and next-lesson recommendations.
 */

// Preset domains supported by default
const PRESET_DOMAINS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'Coding', 'Languages'];

/**
 * Normalizes concept names to prevent near-duplicate splits
 * - Lowercases and trims whitespace
 * - Strips punctuation (e.g. "Newton's Laws" -> "newtons laws")
 * - Collapses multiple spaces
 */
function normalizeConcept(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes general text for search matching
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a standard 11-character YouTube video ID from various URL formats
 * Supports: watch?v=, youtu.be/, embed/, shorts/, or direct 11-char ID.
 */
function extractYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  // Raw 11-char ID (alphanumeric, -, _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // Common YouTube URL patterns
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = clean.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }

  return null;
}

/**
 * Computes accuracy per concept across all quiz attempts.
 * Uses normalized concept names to merge duplicates.
 * Flags concepts below 70% (0.70) accuracy as gaps.
 * Sorted weakest first (lowest accuracy first).
 */
function computeConceptAccuracy(quizAttempts) {
  if (!Array.isArray(quizAttempts) || quizAttempts.length === 0) {
    return [];
  }

  const hits = {};
  const misses = {};
  const totals = {};

  quizAttempts.forEach(attempt => {
    if (Array.isArray(attempt.hit)) {
      attempt.hit.forEach(c => {
        const norm = normalizeConcept(c);
        if (!norm) return;
        hits[norm] = (hits[norm] || 0) + 1;
        totals[norm] = (totals[norm] || 0) + 1;
      });
    }
    if (Array.isArray(attempt.miss)) {
      attempt.miss.forEach(c => {
        const norm = normalizeConcept(c);
        if (!norm) return;
        misses[norm] = (misses[norm] || 0) + 1;
        totals[norm] = (totals[norm] || 0) + 1;
      });
    }
  });

  const list = [];
  for (const concept in totals) {
    const hit = hits[concept] || 0;
    const miss = misses[concept] || 0;
    const total = totals[concept];
    const accuracy = total > 0 ? hit / total : 0;
    list.push({
      concept,
      accuracy,
      hit,
      miss,
      total,
      isGap: accuracy < 0.70
    });
  }

  // Sort weakest first (lowest accuracy), break ties with highest total attempts
  list.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.total - a.total;
  });

  return list;
}

/**
 * Calculates the next best lesson to study based on the student's weak concepts.
 * 
 * Formula:
 * candidates = lessons in current domain (or all if currentDomain === 'All')
 * unwatched = candidates where !watched
 * matches(lesson) = gap concepts that appear in lower-case(title + tags + tr.slice(0, 3000))
 * score(lesson) = sum over matches of (1 - accuracy)
 * pick = highest score unwatched lesson
 * If all are watched, recommends reviewing the highest-scoring watched lesson.
 */
function calculateNextLesson(videos, quizAttempts, currentDomain) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return null;
  }

  const concepts = computeConceptAccuracy(quizAttempts);
  const gapConcepts = concepts.filter(c => c.isGap);

  const domainFilter = (currentDomain || 'All').trim().toLowerCase();
  const candidates = domainFilter === 'all'
    ? [...videos]
    : videos.filter(v => (v.domain || '').trim().toLowerCase() === domainFilter);

  if (candidates.length === 0) {
    return null;
  }

  const unwatched = candidates.filter(v => !v.w);

  if (unwatched.length > 0) {
    let bestLesson = unwatched[0];
    let bestScore = -1;
    let matchedConceptsForBest = [];

    unwatched.forEach(lesson => {
      const tagsStr = Array.isArray(lesson.tags) ? lesson.tags.join(' ') : '';
      const trStr = (lesson.tr || '').slice(0, 3000);
      const searchable = normalizeText(`${lesson.title || ''} ${tagsStr} ${trStr}`);

      let score = 0;
      const matched = [];

      gapConcepts.forEach(gap => {
        const normGap = normalizeConcept(gap.concept);
        if (normGap && searchable.includes(normGap)) {
          score += (1 - gap.accuracy);
          matched.push(gap);
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestLesson = lesson;
        matchedConceptsForBest = matched;
      }
    });

    let reason = '';
    if (matchedConceptsForBest.length > 0) {
      const names = matchedConceptsForBest
        .map(m => `"${m.concept}" (${Math.round(m.accuracy * 100)}% accuracy)`)
        .join(', ');
      reason = `Targets your weak concepts: ${names}.`;
    } else {
      const domainName = domainFilter === 'all' ? 'current' : currentDomain;
      reason = `Next sequential unwatched lesson in your ${domainName} curriculum.`;
    }

    return {
      lesson: bestLesson,
      reason,
      score: Math.max(0, bestScore),
      allWatched: false
    };
  } else {
    // All watched! Suggest revisiting the lesson that best reinforces weak concepts
    let bestLesson = candidates[0];
    let bestScore = -1;
    let matchedConceptsForBest = [];

    candidates.forEach(lesson => {
      const tagsStr = Array.isArray(lesson.tags) ? lesson.tags.join(' ') : '';
      const trStr = (lesson.tr || '').slice(0, 3000);
      const searchable = normalizeText(`${lesson.title || ''} ${tagsStr} ${trStr}`);

      let score = 0;
      const matched = [];

      gapConcepts.forEach(gap => {
        const normGap = normalizeConcept(gap.concept);
        if (normGap && searchable.includes(normGap)) {
          score += (1 - gap.accuracy);
          matched.push(gap);
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestLesson = lesson;
        matchedConceptsForBest = matched;
      }
    });

    let reason = "You've completed all lessons in this subject! ";
    if (matchedConceptsForBest.length > 0) {
      const names = matchedConceptsForBest.map(m => `"${m.concept}"`).join(', ');
      reason += `Review "${bestLesson.title}" to reinforce weak concepts: ${names}.`;
    } else {
      reason += `Revisit "${bestLesson.title}" and retake its quiz for mastery.`;
    }

    return {
      lesson: bestLesson,
      reason,
      score: Math.max(0, bestScore),
      allWatched: true
    };
  }
}

/**
 * Calculates study statistics and milestones
 */
function calculateStats(videos, quizAttempts, totalSeconds) {
  const v = Array.isArray(videos) ? videos : [];
  const q = Array.isArray(quizAttempts) ? quizAttempts : [];
  const secs = typeof totalSeconds === 'number' && totalSeconds >= 0 ? totalSeconds : 0;

  const totalLessons = v.length;
  const watchedLessons = v.filter(item => Boolean(item.w)).length;
  const quizzesTaken = q.length;

  let totalScorePct = 0;
  q.forEach(attempt => {
    const total = attempt.n || 5;
    const score = attempt.s || 0;
    const pct = total > 0 ? (score / total) * 100 : 0;
    totalScorePct += pct;
  });

  const avgScore = quizzesTaken > 0 ? Math.round(totalScorePct / quizzesTaken) : 0;

  // Recent scores (last 12 attempts)
  const recentScores = q.slice(-12).map(attempt => {
    const total = attempt.n || 5;
    const score = attempt.s || 0;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return {
      id: attempt.id,
      score,
      total,
      pct,
      at: attempt.at || Date.now()
    };
  });

  // Milestones definition
  const milestones = [
    { id: 'first_lesson', label: 'First lesson watched', unlocked: watchedLessons >= 1 },
    { id: 'first_quiz', label: 'First quiz taken', unlocked: quizzesTaken >= 1 },
    { id: 'focus_1h', label: '1 hour focused', unlocked: secs >= 3600 },
    { id: 'five_quizzes', label: '5 quizzes done', unlocked: quizzesTaken >= 5 },
    { id: 'mastery_80', label: '80% average score', unlocked: quizzesTaken >= 3 && avgScore >= 80 },
    { id: 'ten_lessons', label: '10 lessons watched', unlocked: watchedLessons >= 10 }
  ];

  return {
    totalSeconds: secs,
    hoursFocused: (secs / 3600).toFixed(1),
    totalLessons,
    watchedLessons,
    quizzesTaken,
    avgScore,
    recentScores,
    milestones
  };
}

module.exports = {
  PRESET_DOMAINS,
  normalizeConcept,
  normalizeText,
  extractYouTubeId,
  computeConceptAccuracy,
  calculateNextLesson,
  calculateStats
};
