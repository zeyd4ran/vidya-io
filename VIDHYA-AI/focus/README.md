# FocusLearn Backend Module

FocusLearn is a distraction-free video learning module with an AI tutor, knowledge gap detection, server-graded quizzes, and personalized next-lesson recommendations.

---

## 1. Run Instructions

### Prerequisites
- Node.js >= 18 (Node 20+ recommended)
- Express 4 backend

### Running Standalone Tests
To run the FocusLearn test suite:
```bash
node --test focus/__tests__/focus.test.js
```

### Running with the Full Server
FocusLearn is mounted automatically in `server.js` under `/api/focus`:
```bash
JWT_SECRET=your_jwt_secret node server.js
```

---

## 2. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Secret key for signing and verifying JWT authentication tokens. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for live AI snapshot tutoring and dynamic quiz generation. Sent securely in request headers (`x-goog-api-key`), never in URL query strings. |
| `FOCUS_AI_KEY` | Optional | Fallback variable for Gemini API key if `GEMINI_API_KEY` is not set. |

*Note: If no API key is provided in the environment or if external calls fail, endpoints return an honest, structured 503 error stating the AI service is unavailable.*

---

## 3. API Endpoints

All endpoints are mounted at `/api/focus`, require a valid `Authorization: Bearer <token>` header, and are completely isolated per user (`req.user.id`).

| Method | Endpoint | Description | Request Body / Query |
|---|---|---|---|
| `POST` | `/api/focus/ask` | Snapshot bot tutor for text questions and screenshot frame analysis. | `{ question?: string, tr?: string, image?: string (base64 up to 5MB), videoId?: string }` |
| `POST` | `/api/focus/quiz/generate` | Generates 5 MCQs for a lesson. **Correct answers are retained on the server** and not exposed in the response. | `{ videoId: string, title?: string, domain?: string, tr?: string, tags?: string[] }` |
| `POST` | `/api/focus/quiz/submit` | Grades submitted answers on the server, updates concept accuracy & gap metrics, and returns explanations. | `{ quizId: string, answers: { [questionIndex]: optionIndex } }` |
| `GET` | `/api/focus/gaps` | Returns accuracy per concept and flags concepts below 70% as gaps. | None |
| `GET` | `/api/focus/next` | Computes the next best lesson according to weak concepts formula: $\text{Score} = \sum (1 - \text{Accuracy})$. | None |
| `GET` | `/api/focus/progress` | Returns cumulative focus seconds, lessons completed, quiz score trends, and unlocked milestones. | None |
| `PUT` | `/api/focus/settings` | Updates active domain, feed lock status, or timer seconds. | `{ domain?: string, locked?: boolean, secs?: number }` |
| `GET` | `/api/focus/videos` | Lists all videos in the authenticated user's feed. | None |
| `POST` | `/api/focus/videos` | Adds a video lesson. Enforces domain lock if locked and rejects duplicates. | `{ urlOrId: string, title?: string, domain?: string, tags?: string[], tr?: string }` |
| `PATCH` | `/api/focus/videos/:id` | Updates lesson properties (notes, watched status, title, tags). | `{ title?: string, domain?: string, tags?: string[], tr?: string, w?: boolean }` |
| `DELETE` | `/api/focus/videos/:id` | Removes a lesson from user feed. | None |
| `POST` | `/api/focus/timer` | Updates focus study timer seconds. | `{ secs: number }` |

---

## 4. Data Model & Storage

FocusLearn data is completely isolated from `db.js` and stored in `data/focus.json`. All file writes are atomic (using temporary file creation followed by `fs.renameSync` with a cross-platform fallback).

```json
{
  "users": {
    "<userId>": {
      "domain": "Physics",
      "locked": false,
      "secs": 5400,
      "v": [
        {
          "id": "dQw4w9WgXcQ",
          "title": "Newton's laws",
          "domain": "Physics",
          "tags": ["newton laws", "friction"],
          "tr": "Transcript text...",
          "w": true
        }
      ],
      "q": [
        {
          "id": "dQw4w9WgXcQ",
          "s": 4,
          "n": 5,
          "hit": ["newton laws"],
          "miss": ["friction"],
          "at": 1767100000000
        }
      ],
      "pendingQuizzes": {
        "quiz_1767100000000_abc": {
          "videoId": "dQw4w9WgXcQ",
          "questions": [
            {
              "q": "What is force?",
              "options": ["A", "B", "C", "D"],
              "answer": 0,
              "concept": "newton laws",
              "explanation": "F = ma."
            }
          ],
          "createdAt": 1767100000000
        }
      }
    }
  }
}
```

---

## 5. How to Remove the Module

To cleanly uninstall the FocusLearn backend module:
1. Delete the `focus/` directory:
   ```bash
   rm -rf focus/
   ```
2. Remove the single mount line from `server.js`:
   ```javascript
   app.use('/api/focus', require('./focus/focusRoutes'));
   ```
3. Optionally delete the database file `data/focus.json`.
