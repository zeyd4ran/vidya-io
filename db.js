const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'vidya_database.json');
const DB_TMP_FILE = DB_FILE + '.tmp';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const COLLECTIONS = [
  'users','sessions','profiles','user_memory','onboarding','subjects','topics',
  'conversations','conversation_messages','doubts','doubt_messages','ai_usage',
  'videos','notes','note_versions','mind_maps','mind_map_nodes',
  'flashcard_decks','flashcards','flashcard_reviews',
  'tests','test_questions','test_options','test_attempts','test_answers',
  'assessments','mistakes','revision_items',
  'study_plans','study_sessions','study_rooms','room_members','room_messages',
  'forum_posts','forum_comments','forum_likes','forum_bookmarks',
  'streaks','productivity_scores','leaderboard_entries','leaderboard_events','leaderboard_snapshots',
  'notifications','uploaded_files','processing_jobs','audit_logs',
  'question_bank'
];

let db = {};
COLLECTIONS.forEach(c => { db[c] = []; });

// P2: Per-collection counters instead of Math.max(...spread)
const _counters = {};

/** Get next auto-increment ID for a collection */
function nextId(collectionName) {
  if (_counters[collectionName] === undefined) {
    const col = db[collectionName];
    _counters[collectionName] = (col && col.length) ? Math.max(...col.map(r => r.id || 0)) : 0;
  }
  _counters[collectionName]++;
  return _counters[collectionName];
}

/** Find record by id */
function findById(collectionName, id) {
  return db[collectionName]?.find(r => r.id === parseInt(id, 10)) || null;
}

/** Find records by user_id */
function findByUserId(collectionName, userId) {
  return db[collectionName]?.filter(r => r.user_id === parseInt(userId, 10)) || [];
}

/** Simple transaction wrapper */
function transaction(fn) {
  try {
    const result = fn();
    saveDB();
    return result;
  } catch (err) {
    loadDB(); // rollback
    throw err;
  }
}

// P2: Debounce saveDB so bursts do not block the event loop
let _saveTimer = null;
const SAVE_DEBOUNCE_MS = 250;

/** Persist database to disk — debounced and atomic */
function saveDB() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_writeDBSync, SAVE_DEBOUNCE_MS);
}

/** Immediate synchronous write (used by saveDB timer and transaction) */
function _writeDBSync() {
  try {
    // P2: Atomic write: write to .tmp then rename
    fs.writeFileSync(DB_TMP_FILE, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(DB_TMP_FILE, DB_FILE);
  } catch (err) {
    console.error('[DB] Write failed:', err.message);
  }
}

/** Flush any pending debounced write immediately (for tests / shutdown) */
function flushDB() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  _writeDBSync();
}

/** Load database from disk or seed */
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      COLLECTIONS.forEach(c => { db[c] = parsed[c] || []; });
      // Rebuild counters from loaded data
      COLLECTIONS.forEach(c => {
        const col = db[c];
        _counters[c] = (col && col.length) ? Math.max(...col.map(r => r.id || 0)) : 0;
      });
      console.log('[DB] Loaded persistent database (' + db.users.length + ' users)');
      return;
    } catch (err) {
      console.error('[DB] Parse error, re-seeding:', err.message);
    }
  }
  seedDatabase();
  _writeDBSync(); // immediate write for seed
}

function seedDatabase() {
  // P0-6: Only seed demo accounts when NOT in production
  if (process.env.NODE_ENV === 'production') {
    console.log('[DB] Production mode — skipping demo account seed.');
    return;
  }

  console.log('[DB] Seeding development database...');
  const now = new Date();
  const iso = now.toISOString();
  const today = iso.split('T')[0];
  const hash = bcrypt.hashSync('password123', 10);

  // USERS
  db.users = [
    { id: 1, email: 'student@vidya.ai', password_hash: hash, role: 'student', email_verified: true, created_at: new Date(now - 30*86400000).toISOString(), updated_at: iso },
    { id: 2, email: 'teacher@vidya.ai', password_hash: hash, role: 'teacher', email_verified: true, created_at: new Date(now - 60*86400000).toISOString(), updated_at: iso },
    { id: 3, email: 'admin@vidya.ai', password_hash: hash, role: 'admin', email_verified: true, created_at: new Date(now - 90*86400000).toISOString(), updated_at: iso }
  ];

  // PROFILES
  db.profiles = [
    { user_id: 1, name: 'Alex Johnson', avatar: '🎓', bio: 'JEE 2027 Aspirant | Physics & Math Focus', subjects: ['Physics','Chemistry','Mathematics'], learning_goals: 'AIR < 500 in JEE Main 2027', timezone: 'Asia/Kolkata', study_preference: 'Visual + Socratic' },
    { user_id: 2, name: 'Dr. Ramesh Kumar', avatar: '👨‍🏫', bio: 'Senior Physics Mentor | 15 years experience', subjects: ['Physics'], learning_goals: 'Help students crack JEE', timezone: 'Asia/Kolkata', study_preference: 'Problem-solving' },
    { user_id: 3, name: 'Vidya Admin', avatar: '🛡️', bio: 'System Governance & Moderation', subjects: [], learning_goals: 'Platform health', timezone: 'Asia/Kolkata', study_preference: 'N/A' }
  ];

  // ONBOARDING
  db.onboarding = [
    { user_id: 1, name: 'Alex Johnson', academic_level: 'Class 12', exam: 'JEE Main & Advanced 2027', exam_date: '2027-01-24', subjects: ['Physics','Chemistry','Mathematics'], syllabus: 'NTA JEE 2027', daily_study_hours: 6, strong_subjects: ['Mathematics','Differential Calculus'], weak_subjects: ['Physics (Capacitance)','Chemistry (Organic)'], daily_goal: 'Solve 25 Physics numericals & 1 revision session', target_score: '280/300' }
  ];

  // USER MEMORY
  db.user_memory = [
    { id: 1, user_id: 1, weak_topics: ['Capacitance & Dielectrics','Organic Reaction Mechanisms','Rotational Dynamics'], strong_topics: ['Differential Calculus','Coulomb Law','Mole Concept','Linear Algebra'], learning_style: 'Visual step-by-step Socratic guidance', important_notes: ['Always check battery connected vs disconnected in capacitor problems'], performance_summary: 'Strong in Math (85%), needs improvement in Physics Capacitance (60%)', last_updated: iso }
  ];

  // STREAKS
  db.streaks = [
    { user_id: 1, current_streak: 14, max_streak: 22, last_activity_date: today },
    { user_id: 2, current_streak: 45, max_streak: 120, last_activity_date: today },
    { user_id: 3, current_streak: 5, max_streak: 10, last_activity_date: today }
  ];

  // PRODUCTIVITY SCORES
  db.productivity_scores = [
    { user_id: 1, overall_score: 84, consistency: 92, assessment: 78, activity: 85, revision: 81, study_hours_week: 32, updated_at: iso },
    { user_id: 2, overall_score: 96, consistency: 98, assessment: 95, activity: 94, revision: 97, study_hours_week: 40, updated_at: iso },
    { user_id: 3, overall_score: 60, consistency: 70, assessment: 50, activity: 65, revision: 55, study_hours_week: 10, updated_at: iso }
  ];

  // CONVERSATIONS
  db.conversations = [
    { id: 1, user_id: 1, title: 'Capacitance Energy Derivation', subject: 'Physics', topic: 'Capacitance', message_count: 4, created_at: new Date(now - 2*86400000).toISOString(), updated_at: iso },
    { id: 2, user_id: 1, title: 'Integration by Parts', subject: 'Mathematics', topic: 'Calculus', message_count: 2, created_at: new Date(now - 5*86400000).toISOString(), updated_at: new Date(now - 5*86400000).toISOString() }
  ];

  db.conversation_messages = [
    { id: 1, conversation_id: 1, role: 'user', content: 'How do I derive the energy stored in a capacitor?', created_at: new Date(now - 2*86400000).toISOString() },
    { id: 2, conversation_id: 1, role: 'assistant', content: 'The energy stored in a capacitor is derived from the work done in charging it. Starting from dW = V dq = (q/C) dq, integrating from 0 to Q gives U = Q²/(2C) = ½CV² = ½QV.', created_at: new Date(now - 2*86400000 + 5000).toISOString() },
    { id: 3, conversation_id: 1, role: 'user', content: 'What happens when a dielectric is inserted with the battery disconnected?', created_at: new Date(now - 2*86400000 + 60000).toISOString() },
    { id: 4, conversation_id: 1, role: 'assistant', content: 'With battery disconnected, charge Q remains constant. Capacitance becomes C\' = KC. Energy becomes U\' = Q²/(2KC) = U/K. Energy decreases by factor K because the dielectric is pulled in by the electric field, doing work.', created_at: new Date(now - 2*86400000 + 65000).toISOString() },
    { id: 5, conversation_id: 2, role: 'user', content: 'Explain integration by parts with an example', created_at: new Date(now - 5*86400000).toISOString() },
    { id: 6, conversation_id: 2, role: 'assistant', content: 'Integration by parts: ∫u dv = uv - ∫v du. Example: ∫x·eˣ dx. Let u=x, dv=eˣdx. Then du=dx, v=eˣ. Result: x·eˣ - ∫eˣdx = x·eˣ - eˣ + C = eˣ(x-1) + C.', created_at: new Date(now - 5*86400000 + 5000).toISOString() }
  ];

  // FLASHCARD DECKS
  db.flashcard_decks = [
    { id: 1, user_id: 1, title: 'Physics High-Yield Formulas', subject: 'Physics', description: 'Essential formulas for JEE Main & Advanced', card_count: 4, created_at: new Date(now - 10*86400000).toISOString() },
    { id: 2, user_id: 1, title: 'Organic Chemistry Reactions', subject: 'Chemistry', description: 'Named reactions and mechanisms', card_count: 3, created_at: new Date(now - 7*86400000).toISOString() }
  ];

  // FLASHCARDS with SM-2 fields
  db.flashcards = [
    { id: 1, deck_id: 1, user_id: 1, topic: 'Capacitance', question: 'What is the stored energy in a capacitor charged to potential V?', answer: 'U = ½CV² = Q²/(2C) = ½QV', repetitions: 2, interval: 6, easiness_factor: 2.5, next_review_date: new Date(now - 86400000).toISOString(), status: 'Needs Review', created_at: new Date(now - 10*86400000).toISOString() },
    { id: 2, deck_id: 1, user_id: 1, topic: 'Gauss Law', question: 'State Gauss\'s Law in electrostatics', answer: 'The total electric flux through any closed surface equals (1/ε₀) times the total charge enclosed. ∮E·dA = Q_enc/ε₀', repetitions: 5, interval: 15, easiness_factor: 2.6, next_review_date: new Date(now + 3*86400000).toISOString(), status: 'Mastered', created_at: new Date(now - 10*86400000).toISOString() },
    { id: 3, deck_id: 1, user_id: 1, topic: 'Coulomb Law', question: 'Write Coulomb\'s law and its vector form', answer: 'F = kq₁q₂/r². Vector: F₁₂ = kq₁q₂/r² r̂₁₂. k = 1/(4πε₀) = 9×10⁹ Nm²/C²', repetitions: 4, interval: 10, easiness_factor: 2.7, next_review_date: new Date(now + 1*86400000).toISOString(), status: 'Reviewing', created_at: new Date(now - 10*86400000).toISOString() },
    { id: 4, deck_id: 1, user_id: 1, topic: 'Electric Field', question: 'Electric field due to infinite line charge', answer: 'E = λ/(2πε₀r) directed radially outward. λ = linear charge density (C/m)', repetitions: 0, interval: 1, easiness_factor: 2.5, next_review_date: iso, status: 'New', created_at: new Date(now - 5*86400000).toISOString() },
    { id: 5, deck_id: 2, user_id: 1, topic: 'SN1 Reaction', question: 'What are the characteristics of SN1 reaction?', answer: 'Unimolecular, 2-step mechanism, carbocation intermediate, racemization, favored by polar protic solvents, 3° > 2° > 1° substrate reactivity', repetitions: 1, interval: 1, easiness_factor: 2.3, next_review_date: new Date(now - 2*86400000).toISOString(), status: 'Needs Review', created_at: new Date(now - 7*86400000).toISOString() },
    { id: 6, deck_id: 2, user_id: 1, topic: 'Aldol Condensation', question: 'What is Aldol condensation?', answer: 'Base-catalyzed reaction of aldehyde/ketone with α-hydrogen → β-hydroxy aldehyde/ketone (aldol) → dehydration gives α,β-unsaturated carbonyl', repetitions: 3, interval: 8, easiness_factor: 2.4, next_review_date: new Date(now + 2*86400000).toISOString(), status: 'Reviewing', created_at: new Date(now - 7*86400000).toISOString() },
    { id: 7, deck_id: 2, user_id: 1, topic: 'Grignard Reagent', question: 'How is Grignard reagent prepared and what does it react with?', answer: 'RMgX prepared by R-X + Mg in dry ether. Reacts with: aldehydes→2° alcohol, ketones→3° alcohol, CO₂→carboxylic acid, epoxides→alcohol', repetitions: 0, interval: 1, easiness_factor: 2.5, next_review_date: iso, status: 'New', created_at: new Date(now - 3*86400000).toISOString() }
  ];

  // FLASHCARD REVIEWS
  db.flashcard_reviews = [
    { id: 1, card_id: 1, user_id: 1, rating: 3, response_time_ms: 8500, review_date: new Date(now - 7*86400000).toISOString() },
    { id: 2, card_id: 1, user_id: 1, rating: 4, response_time_ms: 5200, review_date: new Date(now - 1*86400000).toISOString() },
    { id: 3, card_id: 2, user_id: 1, rating: 5, response_time_ms: 3100, review_date: new Date(now - 3*86400000).toISOString() },
    { id: 4, card_id: 5, user_id: 1, rating: 2, response_time_ms: 12000, review_date: new Date(now - 2*86400000).toISOString() }
  ];

  // NOTES
  db.notes = [
    { id: 1, user_id: 1, title: 'Capacitance Core Formulas', subject: 'Physics', topic: 'Capacitance', content: '# Capacitance\n\n## Parallel Plate: C = ε₀A/d\n## Energy: U = ½CV² = Q²/(2C)\n## With Dielectric: C\' = KC₀\n\n### Key Points:\n- Battery connected → V constant, C increases, Q increases, U increases\n- Battery disconnected → Q constant, C increases, V decreases, U decreases', tags: ['physics','capacitance','jee','formulas'], is_pinned: true, is_favorited: true, is_archived: false, created_at: new Date(now - 5*86400000).toISOString(), updated_at: iso },
    { id: 2, user_id: 1, title: 'Organic Reaction Mechanisms', subject: 'Chemistry', topic: 'Organic Chemistry', content: '# Named Reactions\n\n## Aldol Condensation\nBase-catalyzed self-condensation of aldehydes\n\n## Cannizzaro Reaction\nDisproportionation of non-enolizable aldehydes\n\n## Wurtz Reaction\n2R-X + 2Na → R-R + 2NaX', tags: ['chemistry','organic','reactions'], is_pinned: false, is_favorited: true, is_archived: false, created_at: new Date(now - 3*86400000).toISOString(), updated_at: new Date(now - 1*86400000).toISOString() },
    { id: 3, user_id: 1, title: 'Calculus Integration Techniques', subject: 'Mathematics', topic: 'Calculus', content: '# Integration Methods\n\n## By Parts: ∫u dv = uv - ∫v du\n## Substitution: ∫f(g(x))g\'(x)dx = ∫f(u)du\n## Partial Fractions: Decompose rational functions\n\n### Tips:\n- LIATE rule for choosing u in integration by parts\n- L=Log, I=Inverse trig, A=Algebraic, T=Trig, E=Exponential', tags: ['math','calculus','integration'], is_pinned: false, is_favorited: false, is_archived: false, created_at: new Date(now - 8*86400000).toISOString(), updated_at: new Date(now - 8*86400000).toISOString() }
  ];

  db.note_versions = [
    { id: 1, note_id: 1, content: '# Capacitance\n## C = ε₀A/d', version: 1, created_at: new Date(now - 5*86400000).toISOString() },
    { id: 2, note_id: 1, content: db.notes[0].content, version: 2, created_at: iso }
  ];

  // MIND MAPS
  db.mind_maps = [
    { id: 1, user_id: 1, title: 'Electrostatics Overview', subject: 'Physics', topic: 'Electrostatics', created_at: new Date(now - 4*86400000).toISOString(), updated_at: iso },
    { id: 2, user_id: 1, title: 'Organic Chemistry Map', subject: 'Chemistry', topic: 'Organic', created_at: new Date(now - 2*86400000).toISOString(), updated_at: new Date(now - 2*86400000).toISOString() }
  ];

  db.mind_map_nodes = [
    { id: 1, map_id: 1, parent_id: null, label: 'Electrostatics', x: 400, y: 50, color: '#6366f1', expanded: true },
    { id: 2, map_id: 1, parent_id: 1, label: 'Coulomb Law', x: 200, y: 150, color: '#818cf8', expanded: true },
    { id: 3, map_id: 1, parent_id: 1, label: 'Electric Field', x: 400, y: 150, color: '#818cf8', expanded: true },
    { id: 4, map_id: 1, parent_id: 1, label: 'Capacitance', x: 600, y: 150, color: '#818cf8', expanded: true },
    { id: 5, map_id: 1, parent_id: 4, label: 'C = ε₀A/d', x: 550, y: 250, color: '#a5b4fc', expanded: false },
    { id: 6, map_id: 1, parent_id: 4, label: 'Dielectrics', x: 700, y: 250, color: '#a5b4fc', expanded: false },
    { id: 7, map_id: 2, parent_id: null, label: 'Organic Chemistry', x: 400, y: 50, color: '#10b981', expanded: true },
    { id: 8, map_id: 2, parent_id: 7, label: 'Named Reactions', x: 250, y: 150, color: '#34d399', expanded: true },
    { id: 9, map_id: 2, parent_id: 7, label: 'Functional Groups', x: 550, y: 150, color: '#34d399', expanded: true }
  ];

  // REVISION ITEMS (priority calculated from performance data)
  db.revision_items = [
    { id: 1, user_id: 1, title: 'Capacitance with Dielectrics', subject: 'Physics', topic: 'Capacitance', type: 'Test Mistake', priority: 'HIGH', priority_score: 95, reason: 'Scored 40% in last Capacitance test - 3 conceptual mistakes detected', recommended_action: 'Review notes + solve 5 numericals + retake mini test', status: 'Pending', due_date: today, created_at: new Date(now - 2*86400000).toISOString() },
    { id: 2, user_id: 1, title: 'SN1 vs SN2 Mechanisms', subject: 'Chemistry', topic: 'Organic Chemistry', type: 'Flashcard Weakness', priority: 'HIGH', priority_score: 88, reason: 'Flashcard rating 2/5 - concept confusion between SN1 and SN2', recommended_action: 'Re-read mechanism notes + practice 3 mechanism problems', status: 'Pending', due_date: today, created_at: new Date(now - 3*86400000).toISOString() },
    { id: 3, user_id: 1, title: 'Rotational Dynamics Formulas', subject: 'Physics', topic: 'Rotational Dynamics', type: 'Long Gap', priority: 'MEDIUM', priority_score: 65, reason: 'Last revised 14 days ago - memory decay likely', recommended_action: 'Quick formula review + 3 concept questions', status: 'Pending', due_date: new Date(now + 86400000).toISOString().split('T')[0], created_at: new Date(now - 7*86400000).toISOString() },
    { id: 4, user_id: 1, title: 'Definite Integrals Properties', subject: 'Mathematics', topic: 'Calculus', type: 'Scheduled Review', priority: 'MEDIUM', priority_score: 55, reason: 'Scheduled spaced review from study planner', recommended_action: 'Solve 5 definite integral problems using properties', status: 'Pending', due_date: new Date(now + 2*86400000).toISOString().split('T')[0], created_at: new Date(now - 5*86400000).toISOString() },
    { id: 5, user_id: 1, title: 'Chemical Bonding - Hybridization', subject: 'Chemistry', topic: 'Chemical Bonding', type: 'AI Recommendation', priority: 'LOW', priority_score: 35, reason: 'Strong area but periodic review recommended for retention', recommended_action: 'Quick flashcard review session', status: 'Completed', due_date: new Date(now - 86400000).toISOString().split('T')[0], completed_at: new Date(now - 86400000).toISOString(), created_at: new Date(now - 10*86400000).toISOString() }
  ];

  // STUDY ROOMS
  db.study_rooms = [
    { id: 1, room_code: 'JEE-PHYS-101', title: '⚡ JEE Physics — Electrostatics Sprint', subject: 'Physics', goal: 'Solve 30 Capacitance & Gauss Law numericals in 2 hours', host_user_id: 1, host_name: 'Alex Johnson', participant_count: 6, max_participants: 15, is_active: true, is_public: true, timer_mins: 25, timer_seconds_left: 1250, timer_running: false, created_at: new Date(now - 86400000).toISOString() },
    { id: 2, room_code: 'NEET-CHEM-202', title: '🧪 Chemistry Marathon — Organic Reactions', subject: 'Chemistry', goal: 'Complete all named reactions + mechanisms practice', host_user_id: 2, host_name: 'Dr. Ramesh Kumar', participant_count: 12, max_participants: 20, is_active: true, is_public: true, timer_mins: 45, timer_seconds_left: 2700, timer_running: true, created_at: new Date(now - 2*86400000).toISOString() },
    { id: 3, room_code: 'MATH-ADV-303', title: '📐 Advanced Math — Integration Techniques', subject: 'Mathematics', goal: 'Master integration by parts, substitution, and partial fractions', host_user_id: 1, host_name: 'Alex Johnson', participant_count: 4, max_participants: 10, is_active: true, is_public: true, timer_mins: 30, timer_seconds_left: 1800, timer_running: false, created_at: new Date(now - 3*86400000).toISOString() }
  ];

  db.room_members = [
    { id: 1, room_id: 1, user_id: 1, joined_at: new Date(now - 86400000).toISOString() },
    { id: 2, room_id: 1, user_id: 2, joined_at: new Date(now - 43200000).toISOString() },
    { id: 3, room_id: 2, user_id: 1, joined_at: new Date(now - 7200000).toISOString() }
  ];

  db.room_messages = [
    { id: 1, room_id: 1, user_id: 1, sender_name: 'Alex Johnson', text: 'Welcome everyone! Let\'s tackle Capacitance series-parallel questions today.', created_at: new Date(now - 3600000).toISOString() },
    { id: 2, room_id: 1, user_id: 2, sender_name: 'Dr. Ramesh Kumar', text: 'Great initiative! Remember: for series capacitors, 1/C_eq = Σ(1/Ci). Start with Problem Set 4.', created_at: new Date(now - 3000000).toISOString() },
    { id: 3, room_id: 1, user_id: 1, sender_name: 'Alex Johnson', text: 'Got it! Working on Q1 now. The equivalent capacitance of 6μF each in series should be 2μF.', created_at: new Date(now - 2400000).toISOString() },
    { id: 4, room_id: 2, user_id: 2, sender_name: 'Dr. Ramesh Kumar', text: 'Today we cover: Aldol, Cannizzaro, Wurtz, and Grignard reactions. Take notes!', created_at: new Date(now - 1800000).toISOString() }
  ];

  // FORUM POSTS
  db.forum_posts = [
    { id: 1, user_id: 1, author_name: 'Alex Johnson', author_role: 'Student', domain_tag: 'JEE Main', title: 'Shortcut to solve infinite ladder capacitor networks?', content: 'Is there a 60-second symmetry trick for infinite ladder capacitor circuits? I keep running into these in mock tests and they take forever.', upvotes: 18, comment_count: 3, created_at: new Date(now - 3*86400000).toISOString() },
    { id: 2, user_id: 2, author_name: 'Dr. Ramesh Kumar', author_role: 'Teacher', domain_tag: 'Physics', title: 'Common mistakes in Gauss Law application', content: 'Students often make these errors: 1) Choosing wrong Gaussian surface 2) Confusing E·dA with E×dA 3) Not identifying symmetry correctly. Here are worked examples for each case.', upvotes: 45, comment_count: 5, created_at: new Date(now - 5*86400000).toISOString() },
    { id: 3, user_id: 1, author_name: 'Alex Johnson', author_role: 'Student', domain_tag: 'Chemistry', title: 'Best way to memorize organic named reactions?', content: 'I keep mixing up Aldol, Cannizzaro, and Perkin reactions. Any memory tricks or flashcard strategies?', upvotes: 12, comment_count: 2, created_at: new Date(now - 7*86400000).toISOString() },
    { id: 4, user_id: 2, author_name: 'Dr. Ramesh Kumar', author_role: 'Teacher', domain_tag: 'JEE Advanced', title: 'Rotational dynamics — must-know theorems', content: 'Parallel axis theorem, perpendicular axis theorem, and angular momentum conservation are the three pillars. Master these and 80% of rotation problems become solvable.', upvotes: 32, comment_count: 4, created_at: new Date(now - 10*86400000).toISOString() },
    { id: 5, user_id: 1, author_name: 'Alex Johnson', author_role: 'Student', domain_tag: 'Mathematics', title: 'LIATE rule vs ILATE — which is correct?', content: 'Some books say LIATE, others say ILATE for choosing u in integration by parts. What\'s the actual standard for JEE?', upvotes: 8, comment_count: 1, created_at: new Date(now - 12*86400000).toISOString() }
  ];

  db.forum_comments = [
    { id: 1, post_id: 1, user_id: 2, author_name: 'Dr. Ramesh Kumar', content: 'Yes! Use the self-similar property. If the ladder repeats infinitely, adding one more unit doesn\'t change the total. Set up C_eq = C_series(C, C_eq || C_parallel) and solve the quadratic.', created_at: new Date(now - 2.5*86400000).toISOString() },
    { id: 2, post_id: 1, user_id: 1, author_name: 'Alex Johnson', content: 'That quadratic approach is brilliant! Solved a PYQ in 45 seconds with this. Thank you!', created_at: new Date(now - 2*86400000).toISOString() },
    { id: 3, post_id: 2, user_id: 1, author_name: 'Alex Johnson', content: 'The Gaussian surface tip saved me in today\'s mock. Used cylindrical symmetry for infinite wire correctly.', created_at: new Date(now - 4*86400000).toISOString() }
  ];

  db.forum_likes = [
    { id: 1, post_id: 1, user_id: 2 },
    { id: 2, post_id: 2, user_id: 1 },
    { id: 3, post_id: 4, user_id: 1 }
  ];

  db.forum_bookmarks = [
    { id: 1, post_id: 2, user_id: 1 },
    { id: 2, post_id: 4, user_id: 1 }
  ];

  // STUDY PLANS
  db.study_plans = [
    { id: 1, user_id: 1, title: 'JEE 2027 — Weekly Physics Plan', exam: 'JEE Main 2027', start_date: today, end_date: '2027-01-24', subjects: ['Physics'], is_ai_generated: false, created_at: new Date(now - 7*86400000).toISOString() }
  ];

  db.study_sessions = [
    { id: 1, plan_id: 1, user_id: 1, subject: 'Physics', topic: 'Capacitance', type: 'Practice', start_time: '07:00', end_time: '08:30', duration_mins: 90, priority: 'High', status: 'completed', is_recurring: true, recurrence: 'daily', completed_at: new Date(now - 86400000).toISOString(), created_at: new Date(now - 7*86400000).toISOString() },
    { id: 2, plan_id: 1, user_id: 1, subject: 'Physics', topic: 'Gauss Law', type: 'Theory', start_time: '09:00', end_time: '10:30', duration_mins: 90, priority: 'Medium', status: 'pending', is_recurring: true, recurrence: 'daily', created_at: new Date(now - 7*86400000).toISOString() },
    { id: 3, plan_id: 1, user_id: 1, subject: 'Physics', topic: 'Electrostatics', type: 'Revision', start_time: '16:00', end_time: '17:00', duration_mins: 60, priority: 'High', status: 'pending', is_recurring: false, created_at: new Date(now - 3*86400000).toISOString() }
  ];

  // LEADERBOARD
  db.leaderboard_entries = [
    { id: 1, user_id: 2, domain: 'Physics', name: 'Dr. Ramesh Kumar', productivity_score: 96, streak: 45, mastery_pct: 95, tests_completed: 48, flashcards_reviewed: 520, study_hours: 180, rank: 1 },
    { id: 2, user_id: 1, domain: 'JEE Main & Advanced', name: 'Alex Johnson', productivity_score: 84, streak: 14, mastery_pct: 72, tests_completed: 15, flashcards_reviewed: 145, study_hours: 95, rank: 2 },
    { id: 3, user_id: 3, domain: 'General', name: 'Vidya Admin', productivity_score: 60, streak: 5, mastery_pct: 40, tests_completed: 3, flashcards_reviewed: 20, study_hours: 15, rank: 3 }
  ];

  // NOTIFICATIONS
  db.notifications = [
    { id: 1, user_id: 1, type: 'revision', title: '🔴 Revision Due', message: 'Capacitance with Dielectrics is due for revision today. Priority: HIGH', is_read: false, action_url: '/revision', created_at: iso },
    { id: 2, user_id: 1, type: 'streak', title: '🔥 14-Day Streak!', message: 'Amazing! You\'ve maintained a 14-day study streak. Keep going to beat your record of 22 days!', is_read: false, action_url: '/dashboard', created_at: new Date(now - 3600000).toISOString() },
    { id: 3, user_id: 1, type: 'forum', title: '💬 New Reply', message: 'Dr. Ramesh Kumar replied to your post "Shortcut to solve infinite ladder capacitor networks?"', is_read: true, action_url: '/community', created_at: new Date(now - 2*86400000).toISOString() },
    { id: 4, user_id: 1, type: 'flashcard', title: '📚 Cards Due', message: 'You have 3 flashcards due for review today. Don\'t break your recall streak!', is_read: false, action_url: '/flashcards', created_at: new Date(now - 7200000).toISOString() },
    { id: 5, user_id: 1, type: 'planner', title: '📅 Session Starting', message: 'Physics: Gauss Law theory session starts in 30 minutes (09:00 AM)', is_read: false, action_url: '/planner', created_at: new Date(now - 1800000).toISOString() }
  ];

  // TEST ATTEMPTS (seed some historical data)
  db.test_attempts = [
    { id: 1, test_id: 1, user_id: 1, title: 'Physics Capacitance Mock', subject: 'Physics', topic: 'Capacitance', score: 2, total_score: 5, accuracy_pct: 40, time_spent_secs: 720, submitted_at: new Date(now - 4*86400000).toISOString() },
    { id: 2, test_id: 2, user_id: 1, title: 'Mathematics Calculus Test', subject: 'Mathematics', topic: 'Calculus', score: 4, total_score: 5, accuracy_pct: 80, time_spent_secs: 540, submitted_at: new Date(now - 2*86400000).toISOString() }
  ];

  db.mistakes = [
    { id: 1, user_id: 1, attempt_id: 1, question_text: 'Stored energy when plates pulled apart (battery disconnected)', user_answer: 'Decreases', correct_answer: 'Increases', mistake_type: 'Conceptual', topic: 'Capacitance', subject: 'Physics', created_at: new Date(now - 4*86400000).toISOString() }
  ];

  // AUDIT LOGS
  db.audit_logs = [
    { id: 1, user_id: 1, action: 'LOGIN', details: 'Student login', ip: '127.0.0.1', created_at: iso }
  ];

  // QUESTION BANK — Phase 2: curated, tagged questions
  db.question_bank = [
    // Physics — Capacitance
    { id: 1, question: 'A parallel plate capacitor is charged and then disconnected from battery. If plates are pulled further apart, what happens to stored energy?', type: 'MCQ', options: ['Increases', 'Decreases', 'Remains same', 'Becomes zero'], correct_answer: 'Increases', explanation: 'Since Q is constant and C = ε₀A/d decreases as d increases, energy U = Q²/(2C) increases because work is done against electrostatic attraction.', subject: 'Physics', topic: 'Capacitance', difficulty: 'Medium', exam: 'JEE Main', tags: ['capacitance', 'energy', 'dielectric'], is_verified: true, created_at: iso },
    { id: 2, question: 'What is the net electric field inside a hollow spherical conductor carrying charge Q?', type: 'MCQ', options: ['kQ/R²', 'Zero', 'kQ/2R²', 'Infinite'], correct_answer: 'Zero', explanation: 'By Gauss law, enclosing surface inside hollow sphere contains zero charge (Q_enc = 0), so E = 0.', subject: 'Physics', topic: 'Gauss Law', difficulty: 'Easy', exam: 'JEE Main', tags: ['gauss-law', 'conductor', 'electric-field'], is_verified: true, created_at: iso },
    { id: 3, question: 'Calculate equivalent capacitance of three 6μF capacitors connected in series. (Answer in μF)', type: 'Numerical', options: [], correct_answer: '2', explanation: '1/C_eq = 1/6 + 1/6 + 1/6 = 3/6 → C_eq = 2 μF.', subject: 'Physics', topic: 'Capacitance', difficulty: 'Medium', exam: 'JEE Main', tags: ['capacitance', 'series', 'numerical'], is_verified: true, created_at: iso },
    { id: 4, question: 'A dielectric of constant K=4 fills half the space of a capacitor parallel to plates. If original capacitance was C₀, new capacitance is:', type: 'MCQ', options: ['5C₀/2', '2C₀', '4C₀', '8C₀/5'], correct_answer: '8C₀/5', explanation: 'Two series capacitors of thickness d/2: C₁ = 4(2C₀) = 8C₀, C₂ = 2C₀. C_eq = (8C₀ × 2C₀)/(8C₀ + 2C₀) = 8C₀/5.', subject: 'Physics', topic: 'Capacitance', difficulty: 'Hard', exam: 'JEE Advanced', tags: ['capacitance', 'dielectric', 'series'], is_verified: true, created_at: iso },
    { id: 5, question: 'The electric potential at the centre of a uniformly charged ring of radius R carrying charge Q is:', type: 'MCQ', options: ['kQ/R', 'kQ/R²', 'Zero', 'kQ/2R'], correct_answer: 'kQ/R', explanation: 'All charge elements are at the same distance R from the centre, so V = kQ/R.', subject: 'Physics', topic: 'Electric Potential', difficulty: 'Easy', exam: 'JEE Main', tags: ['potential', 'ring', 'symmetry'], is_verified: true, created_at: iso },
    // Physics — Mechanics
    { id: 6, question: 'A body of mass 2 kg is thrown vertically upward with velocity 20 m/s. The kinetic energy at the highest point is:', type: 'MCQ', options: ['400 J', '200 J', '0 J', '100 J'], correct_answer: '0 J', explanation: 'At the highest point, velocity is zero, so KE = 0.', subject: 'Physics', topic: 'Mechanics', difficulty: 'Easy', exam: 'JEE Main', tags: ['kinematics', 'energy', 'projectile'], is_verified: true, created_at: iso },
    { id: 7, question: 'Two blocks of masses 5 kg and 3 kg connected by a string on a frictionless surface are pulled by a force of 16 N applied on the 5 kg block. Tension in the string is:', type: 'Numerical', options: [], correct_answer: '6', explanation: 'Acceleration a = F/(m₁+m₂) = 16/8 = 2 m/s². Tension = m₂ × a = 3 × 2 = 6 N.', subject: 'Physics', topic: 'Mechanics', difficulty: 'Medium', exam: 'JEE Main', tags: ['newton-laws', 'tension', 'numerical'], is_verified: true, created_at: iso },
    // Chemistry — Organic
    { id: 8, question: 'Which of the following undergoes SN1 reaction fastest?', type: 'MCQ', options: ['CH₃Cl', '(CH₃)₃CCl', 'CH₃CH₂Cl', '(CH₃)₂CHCl'], correct_answer: '(CH₃)₃CCl', explanation: 'SN1 rate depends on carbocation stability. Tertiary carbocation from (CH₃)₃CCl is most stable.', subject: 'Chemistry', topic: 'Organic Chemistry', difficulty: 'Medium', exam: 'JEE Main', tags: ['sn1', 'reaction-mechanism', 'carbocation'], is_verified: true, created_at: iso },
    { id: 9, question: 'The product of Wurtz reaction of CH₃Br is:', type: 'MCQ', options: ['Methane', 'Ethane', 'Propane', 'Butane'], correct_answer: 'Ethane', explanation: 'Wurtz reaction: 2CH₃Br + 2Na → CH₃-CH₃ + 2NaBr. Two methyl groups join to form ethane.', subject: 'Chemistry', topic: 'Organic Chemistry', difficulty: 'Easy', exam: 'JEE Main', tags: ['wurtz', 'named-reaction', 'alkane'], is_verified: true, created_at: iso },
    { id: 10, question: 'Aldol condensation is given by:', type: 'MCQ', options: ['HCHO', 'CH₃CHO', 'C₆H₅CHO', 'Both CH₃CHO and HCHO'], correct_answer: 'CH₃CHO', explanation: 'Aldol condensation requires α-hydrogen. CH₃CHO has α-hydrogens. HCHO has no α-H, and C₆H₅CHO has no α-H.', subject: 'Chemistry', topic: 'Organic Chemistry', difficulty: 'Medium', exam: 'JEE Main', tags: ['aldol', 'named-reaction', 'carbonyl'], is_verified: true, created_at: iso },
    // Chemistry — Physical
    { id: 11, question: 'For the reaction N₂ + 3H₂ → 2NH₃, if rate of formation of NH₃ is 0.04 mol/L/s, rate of disappearance of H₂ is:', type: 'Numerical', options: [], correct_answer: '0.06', explanation: 'Rate of disappearance of H₂ = (3/2) × rate of formation of NH₃ = (3/2) × 0.04 = 0.06 mol/L/s.', subject: 'Chemistry', topic: 'Chemical Kinetics', difficulty: 'Medium', exam: 'JEE Main', tags: ['kinetics', 'rate', 'stoichiometry'], is_verified: true, created_at: iso },
    // Mathematics — Calculus
    { id: 12, question: 'The value of ∫₀¹ x·eˣ dx is:', type: 'MCQ', options: ['1', 'e', 'e-1', '1/e'], correct_answer: '1', explanation: 'Integration by parts: ∫x·eˣdx = x·eˣ - eˣ + C. Evaluating from 0 to 1: (1·e - e) - (0 - 1) = 0 + 1 = 1.', subject: 'Mathematics', topic: 'Calculus', difficulty: 'Medium', exam: 'JEE Main', tags: ['integration', 'by-parts', 'definite'], is_verified: true, created_at: iso },
    { id: 13, question: 'If f(x) = x³ - 3x + 2, the number of real roots of f(x) = 0 is:', type: 'MCQ', options: ['1', '2', '3', '0'], correct_answer: '2', explanation: 'f(x) = (x-1)²(x+2). Roots are x = 1 (repeated) and x = -2. Two distinct real roots.', subject: 'Mathematics', topic: 'Calculus', difficulty: 'Medium', exam: 'JEE Main', tags: ['polynomials', 'roots', 'factoring'], is_verified: true, created_at: iso },
    { id: 14, question: 'The derivative of sin²x with respect to cos²x is:', type: 'MCQ', options: ['1', '-1', 'tan²x', '-tan²x'], correct_answer: '-1', explanation: 'd(sin²x)/d(cos²x) = (2sinx·cosx)/(−2cosx·sinx) = −1.', subject: 'Mathematics', topic: 'Calculus', difficulty: 'Easy', exam: 'JEE Main', tags: ['derivative', 'chain-rule', 'trigonometry'], is_verified: true, created_at: iso },
    { id: 15, question: 'The area bounded by y = x², the x-axis, and the lines x = 1 and x = 3 is:', type: 'Numerical', options: [], correct_answer: '8.67', explanation: '∫₁³ x² dx = [x³/3]₁³ = 27/3 - 1/3 = 26/3 ≈ 8.67 sq units.', subject: 'Mathematics', topic: 'Calculus', difficulty: 'Medium', exam: 'JEE Main', tags: ['integration', 'area', 'definite'], is_verified: true, created_at: iso }
  ];

  // Rebuild counters after seeding
  COLLECTIONS.forEach(c => {
    const col = db[c];
    _counters[c] = (col && col.length) ? Math.max(...col.map(r => r.id || 0)) : 0;
  });
}

loadDB();

module.exports = { db, saveDB, flushDB, loadDB, nextId, findById, findByUserId, transaction };
