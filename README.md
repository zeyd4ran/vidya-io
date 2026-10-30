# VIDYA AI — Personal AI Learning Ecosystem & FocusLearn

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-lightgrey.svg)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(75%2F75)-success.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

> **VIDYA AI** is an intelligent, full-stack learning platform designed to eliminate distractions, accelerate comprehension, and adapt to individual learning paces. It pairs deep syllabus-aligned course paths with an interactive AI tutor, spaced repetition (SM-2), real-time doubt resolution, and **FocusLearn**—a distraction-free video learning engine.

---

##  Table of Contents

1. [Overview & Value Proposition](#-overview--value-proposition)
2. [Key Features](#-key-features)
3. [Architecture & Technology Stack](#-architecture--technology-stack)
4. [Getting Started](#-getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running the Application](#running-the-application)
5. [Testing & Quality Verification](#-testing--quality-verification)
6. [FocusLearn Module](#-focuslearn-module)
   - [How It Works](#how-it-works)
   - [Next Best Lesson Algorithm](#next-best-lesson-algorithm)
   - [Standalone Zero-Build Mode](#standalone-zero-build-mode)
7. [API Reference](#-api-reference)
   - [Authentication & User Scoping](#authentication--user-scoping)
   - [FocusLearn Endpoints (`/api/focus`)](#focuslearn-endpoints-apifocus)
   - [AI Tutor & Streaming](#ai-tutor--streaming)
   - [Study Rooms, Flashcards & Tests](#study-rooms-flashcards--tests)
   - [Admin & Job Queue](#admin--job-queue)
8. [Security & Hardening](#-security--hardening)
9. [Project Directory Layout](#-project-directory-layout)
10. [License](#-license)

---

##  Overview & Value Proposition

Online self-learning, especially through video platforms like YouTube, frequently fails due to three fundamental obstacles:
1. **Distraction**: Algorithmic recommendations, comment sections, and unrelated media derail focus.
2. **Passive Consumption**: Watching videos creates an illusion of competence without verifying true understanding.
3. **Lack of Trajectory**: After finishing a lesson, learners are left guessing what concept to tackle next.

**VIDYA AI** and **FocusLearn** solve these bottlenecks by providing:
- **Domain-Locked Feeds**: Strict study subject isolation preventing off-topic browsing.
- **Embedded Clean Player**: YouTube embeds stripped of recommendations, sidebars, and comments.
- **Snapshot AI Tutor**: Real-time step-by-step doubt resolution grounded in video transcripts and screenshot frames.
- **Server-Graded Diagnostic Quizzes**: Auto-generated 5-question MCQs evaluating concept retention.
- **Dynamic Knowledge Gap Tracking**: Automatic detection of concepts with accuracy below 70%.
- **Weighted Next-Lesson Recommendation**: Mathematical ranking suggesting the optimal unwatched lesson addressing personal weak spots.

---

##  Key Features

###  24×7 AI Tutor & Live SSE Streaming
- Ask complex academic doubts with instant streaming responses via Server-Sent Events (`/api/ai/doubt/stream`).
- AI daily insights dynamically personalized using current study streaks and productivity ratings.

###  FocusLearn Distraction-Free Video Engine
- YouTube privacy-enhanced embed (`youtube-nocookie.com`) with related videos and branding stripped.
- Auto-saving transcript and notes editor that preserves typing cursor and caret positions without re-rendering.
- **Snapshot Bot**: Ask questions or paste frame screenshots (<kbd>Ctrl</kbd>+<kbd>V</kbd>) for instant visual analysis.

### Knowledge Gap Detection & Concept Normalization
- Concept names are automatically normalized (punctuation-stripped, trimmed, lowercased) so `"Newton's Laws"` and `"newtons laws"` merge into a unified mastery profile.
- Concepts with accuracy under 70% ($< 0.70$) are flagged as gaps to guide your study queue.

###  Next Best Lesson Recommendation Engine
- Automatically prioritizes unwatched lessons targeting your weakest concepts using the objective formula:
  $$\text{Score}(\text{Lesson}) = \sum_{\text{Matching Gaps}} (1 - \text{Accuracy})$$
- Weaker concepts contribute heavier weight, ensuring high-priority gaps are closed first.

###  Spaced Repetition (SM-2) & Flashcards
- SuperMemo-2 algorithm calculating optimal repetition intervals, easiness factors (EF), and review dates based on recall quality (0–5).

### Background Job Queue & Real-Time WebSockets
- Asynchronous video processing and ingestion jobs with progress reporting, automatic retry backoff, and a dead-letter queue (DLQ).
- Live WebSocket notifications broadcasted to user-scoped rooms upon task completion.

---

##  Architecture & Technology Stack

```
VIDYA-AI Ecosystem
├── Client Layer
│   ├── React 18 + Vite 5 SPA (Dashboard, Syllabus, Planner, Tutor, Assessments)
│   └── Standalone Single-File FocusLearn Web App (focus-learn.html / public/focus-learn.html)
├── API Gateway & Application Server (Express 4)
│   ├── JWT Authentication & Role Authorization (Student, Teacher, Admin)
│   ├── Rate Limiting, Input Validation & Global Error Handler
│   └── WebSocket Real-Time Engine (ws)
├── Subsystems & Engines
│   ├── FocusLearn Module (focus/): Pure Logic, Atomic File Store, Gemini Vision AI
│   ├── AI Gateway (aiGateway.js): Token Budgeting, Template Caching, Usage Logs
│   ├── RAG Vector Engine (ragEngine.js): Chunking, Indexing & Semantic Citations
│   ├── Job Queue & Worker (jobQueue.js / worker.js): State Machines & DLQ
│   └── Spaced Repetition Engine (spacedRepetition.js): SM-2 Scheduling
└── Persistence Layer
    ├── data/vidya_database.json: Main platform database
    └── data/focus.json: Isolated atomic FocusLearn storage (Temp file + Rename)
```

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React 18, Vite 5, Lucide Icons | Modern, reactive dashboard with light/dark themes |
| **Backend** | Node.js (CommonJS), Express 4 | RESTful API with async route wrapping and validation |
| **Realtime** | `ws` (WebSocket) | Live notifications and study room collaboration |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | Secure stateless auth with role checks and redacted password hashes |
| **AI Integration** | Google Gemini API (`gemini-1.5-flash`) | Multimodal vision and structured JSON question generation |
| **Storage** | Atomic JSON File Stores (`data/`) | Zero-dependency file persistence with atomic rename safety |
| **Testing** | Node.js Test Runner (`node:test`), `supertest` | Fast, dependency-free test execution |

---

##  Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Modern Web Browser**: Chrome, Edge, Firefox, or Safari

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/zeyd4ran/vidya-io.git
cd VIDHYA-AI/VIDHYA-AI

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory (or configure system environment variables):

```env
# Server Port (defaults to 5000)
PORT=5000

# Required: Secret key for signing JWT tokens
JWT_SECRET=your_super_secret_jwt_key_2026

# Optional: Google Gemini API key for live AI Tutor and Quiz generation
# Note: The key is sent strictly via HTTP headers ('x-goog-api-key'), never in URL query strings.
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Node environment
NODE_ENV=development
```

### Running the Application

You can run the backend server and frontend development server simultaneously:

#### 1. Start Backend API Server
```bash
npm run server
# Server boots at http://localhost:5000
```

#### 2. Start Frontend Development Server
```bash
npm run dev
# Vite dev server boots at http://localhost:5173
```

#### 3. Build for Production
```bash
npm run build
# Compiles minified bundle to dist/
```

---

##  Testing & Quality Verification

VIDYA AI includes a comprehensive test suite using the built-in Node.js test runner (`node:test`) and `supertest`:

```bash
# Run the entire platform test suite (66 automated tests)
npm test

# Run FocusLearn unit, store, logic, and route tests (9 automated tests)
node --test focus/__tests__/focus.test.js

# Validate syntax across all root JavaScript files
Get-ChildItem -Filter "*.js" | ForEach-Object { node --check $_.Name }
```

### Verified Test Suites
- **SM-2 Algorithm**: Boundary tests, repetitions, interval scaling, EF clamping.
- **RAG Engine**: Semantic chunking, deduplication, stopword filtering, per-user isolation.
- **Job Queue**: UUID uniqueness, progress boundaries, dead-letter retry logic.
- **AI Gateway & Budget**: Token quotas, LRU TTL caching, usage audit logging.
- **Authentication & Security**: Missing token rejection, expired tokens, async bcrypt verification, role injection defense.
- **FocusLearn Logic**: Concept normalizer, gap flagging, unwatched prioritization, server-side grading without answer leaks.

---

## FocusLearn Module

FocusLearn is located at `public/focus-learn.html` and backed by the `/api/focus` route module.

### How It Works
1. **Add Lessons**: Paste any YouTube URL or 11-character video ID, assign a domain (e.g. *Physics*, *Coding*), and enter concept tags.
2. **Lock Feed**: Lock your feed to a single domain to enforce uninterrupted deep work.
3. **Capture Notes**: Type or paste lecture transcripts in the text area (auto-saved without losing typing focus).
4. **Instant Snapshot Bot**: Ask conceptual questions or paste frame screenshots (<kbd>Ctrl</kbd>+<kbd>V</kbd>) for step-by-step assistance.
5. **Take Quizzes**: Generate a 5-question MCQ test. Answers are graded server-side, preventing inspect-element answer cheating.
6. **Track Mastery**: Inspect the **Gaps & Next** tab to see weak concepts and jump directly to recommended videos.

### Next Best Lesson Algorithm
Lessons are evaluated using:
$$\text{Score}(L) = \sum_{c \in \text{Gaps}(L)} (1 - \text{Accuracy}(c))$$
- **Unwatched First**: Unwatched videos matching identified gaps take top priority.
- **Mastery Review**: If all lessons in a subject are watched, the engine suggests the best matching lesson to re-watch and re-quiz.

### Standalone Zero-Build Mode
FocusLearn can run entirely standalone as a single file:
- Open `focus-learn.html` directly in any web browser with **zero build step and no server**.
- Persists all state in `localStorage['fl1']`.
- Full JSON export and import capabilities to backup and restore progress across devices.
- Built-in labeled **"Offline helper (not AI)"** practice mode when internet or backend services are unavailable.

---

##  API Reference

All protected endpoints require an `Authorization: Bearer <token>` header.

### Authentication & User Scoping

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new account (forces `role: 'student'`). Redacts `password_hash`. | No |
| `POST` | `/api/auth/login` | Authenticate with email and password via async `bcrypt.compare`. | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile and onboarding status. | Yes |
| `GET` | `/api/dashboard` | Aggregated dashboard: streaks, productivity, insights, revision. | Yes |

### FocusLearn Endpoints (`/api/focus`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/focus/state` | Returns complete user focus state, concept gaps, next lesson, and stats. |
| `GET` | `/api/focus/videos` | List all videos in the user's personal feed. |
| `POST` | `/api/focus/videos` | Add video. Enforces domain lock and blocks duplicates. |
| `PATCH` | `/api/focus/videos/:id` | Update video watched status, notes/transcript, title, or tags. |
| `DELETE` | `/api/focus/videos/:id` | Remove a video from the user feed. |
| `GET` | `/api/focus/gaps` | Return concept accuracy breakdown and flagged gaps ($< 70\%$). |
| `GET` | `/api/focus/next` | Compute next recommended lesson based on gap scores. |
| `GET` | `/api/focus/progress` | Get study stats, hours focused, and unlocked milestones. |
| `PUT` | `/api/focus/settings` | Update active domain, feed lock, or timer seconds. |
| `POST` | `/api/focus/ask` | Ask tutor questions with optional base64 screenshot image (up to 5MB). |
| `POST` | `/api/focus/quiz/generate` | Generate 5 MCQs. **Answers retained on server**. |
| `POST` | `/api/focus/quiz/submit` | Grade user answers server-side, record attempt, and return explanations. |

### AI Tutor & Streaming

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/doubt/stream?prompt=...` | Server-Sent Events (SSE) streaming doubt explanation. |
| `GET` | `/api/ai/budget` | Check remaining daily token quotas and usage balance. |
| `POST` | `/api/tests/generate` | Generate syllabus tests with answers stripped from client response. |
| `POST` | `/api/tests/submit` | Submit test attempt for evaluation and review. |

### Admin & Job Queue

| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/api/admin/overview` | Platform metrics, active study rooms, and question bank stats. | `admin` |
| `GET` | `/api/admin/question-bank` | List and filter question bank entries. | `admin`, `teacher` |
| `POST` | `/api/admin/question-bank` | Insert new verified question into repository. | `admin`, `teacher` |
| `GET` | `/api/admin/dead-letter` | List failed jobs in the dead-letter queue (DLQ). | `admin` |
| `POST` | `/api/admin/dead-letter/:id/retry` | Re-queue a failed job for execution. | `admin` |

---

## Security & Hardening

1. **Password Security**: Passwords hashed with `bcryptjs` (salt rounds: 10). Authentication compares hashes asynchronously using constant-time comparison to prevent timing attacks.
2. **Sensitive Data Redaction**: `password_hash` is stripped from all user responses using a unified `publicUser()` serializer.
3. **No In-Browser API Keys**: All AI provider keys are kept securely on the server and injected via request headers (`x-goog-api-key`). No user API keys are stored in the browser or localStorage.
4. **Prompt Injection Defense**: Untrusted user inputs, notes, and transcripts are strictly wrapped within security boundary delimiters (`### UNTRUSTED TRANSCRIPT BEGIN ###`) instructing the AI model to ignore embedded directives.
5. **Anti-Cheating Quiz Architecture**: Quizzes generated via `/api/focus/quiz/generate` keep correct answers and explanations on the server in a secure session until submitted.
6. **Strict HTML Sanitization**: All user inputs in the frontend and standalone player are escaped (`esc()`) to prevent Stored and Reflected Cross-Site Scripting (XSS).

---

##  Project Directory Layout

```
VIDHYA-AI/
├── focus-learn.html               # Standalone single-file FocusLearn app (Zero build step)
├── FOCUSLEARN_README.md           # FocusLearn specifications and product documentation
├── HARDENING_BASELINE.md          # Security hardening baseline audit report
├── README.md                      # Primary project documentation
└── VIDHYA-AI/                     # Core full-stack application workspace
    ├── server.js                  # Express 4 server, JWT middleware, routes & static serve
    ├── db.js                      # Main JSON database driver and collections
    ├── aiService.js               # AI tutor generation & daily insights
    ├── aiGateway.js               # Prompt templates, caching, and token budgeting
    ├── ragEngine.js               # Semantic vector chunking, indexing & RAG retrieval
    ├── jobQueue.js                # Background job queue with state transitions & DLQ
    ├── worker.js                  # In-process / standalone asynchronous worker
    ├── questionBank.js            # Question bank repository and verification engine
    ├── uploadService.js           # File attachment and media storage service
    ├── spacedRepetition.js        # SuperMemo-2 (SM-2) spaced repetition algorithm
    ├── realtime.js                # WebSocket engine for live room broadcasts
    ├── test-api.js                # Comprehensive integration test suite (node:test)
    ├── vite.config.js             # Vite 5 bundler configuration
    ├── package.json               # Project manifest, scripts, and dependencies
    │
    ├── focus/                     # FocusLearn backend module
    │   ├── README.md              # Focus module instructions and removal guide
    │   ├── focusLogic.js          # Pure functions: normalization, gaps, recommendation
    │   ├── focusStore.js          # Atomic file storage (data/focus.json)
    │   ├── focusAI.js             # Gemini AI client with timeout, retry & schema checks
    │   ├── focusRoutes.js         # Protected Express routes under /api/focus
    │   └── __tests__/             # FocusLearn test suite
    │       └── focus.test.js      # Automated unit & integration tests
    │
    ├── data/                      # Persistent storage directory
    │   ├── vidya_database.json    # Platform database
    │   └── focus.json             # FocusLearn user storage
    │
    ├── public/                    # Static web assets
    │   └── focus-learn.html       # Web-served FocusLearn single-file application
    │
    └── src/                       # React 18 Frontend
        ├── main.jsx               # React entry point
        ├── App.jsx                # Main application component & routing
        ├── components/            # UI components (MindMapCanvas, AssessmentEngine, etc.)
        └── styles/                # Global styles and theme definitions
```

---

##  License

This project is open-source and available under the [MIT License](LICENSE).
