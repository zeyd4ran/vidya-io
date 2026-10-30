// SuperMemo-2 (SM-2) Spaced Repetition Algorithm Engine for VIDYA AI

function calculateSM2({ quality, repetitions = 0, interval = 1, easinessFactor = 2.5 }) {
  // Quality rating q: 0 (blackout) to 5 (perfect recall)
  const q = Math.max(0, Math.min(5, parseInt(quality, 10) || 0));

  let newRepetitions = repetitions;
  let newInterval = interval;
  let newEasinessFactor = easinessFactor;

  if (q >= 3) {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easinessFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }

  // Update Easiness Factor
  newEasinessFactor = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEasinessFactor < 1.3) newEasinessFactor = 1.3;

  const nextReviewDate = new Date(Date.now() + newInterval * 86400000).toISOString();

  let status = 'Learning';
  if (newRepetitions >= 5) status = 'Mastered';
  else if (q < 3) status = 'Needs Review';
  else status = 'Reviewing';

  return {
    repetitions: newRepetitions,
    interval: newInterval,
    easinessFactor: parseFloat(newEasinessFactor.toFixed(2)),
    nextReviewDate,
    status
  };
}

module.exports = {
  calculateSM2
};
