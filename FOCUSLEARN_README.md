# FocusLearn

A distraction-free video learning tool with an AI tutor. Pick one subject, watch lessons in a clean player, ask questions (including from screenshots), take auto-generated quizzes, see which concepts you have not mastered, and get a recommendation for what to study next.

Everything lives in one HTML file. There is no build step and no server of your own.

**Status:** working prototype. See [Known limitations](#known-limitations) before relying on it.

---

## Table of contents

1. [What problem it solves](#what-problem-it-solves)
2. [Feature overview](#feature-overview)
3. [How to use it](#how-to-use-it)
4. [Features in depth](#features-in-depth)
5. [How the logic works](#how-the-logic-works)
6. [Data model and storage](#data-model-and-storage)
7. [Architecture](#architecture)
8. [Running and deploying](#running-and-deploying)
9. [Customising](#customising)
10. [Privacy and security](#privacy-and-security)
11. [Known limitations](#known-limitations)
12. [Troubleshooting](#troubleshooting)
13. [Manual test checklist](#manual-test-checklist)
14. [Roadmap](#roadmap)
15. [FAQ](#faq)

---

## What problem it solves

Learning from YouTube usually fails for three reasons:

- **Distraction.** Recommendations, comments and unrelated videos pull you off topic.
- **Passive watching.** You finish a video and cannot tell whether you understood it.
- **No direction.** After one lesson you do not know what to watch next.

FocusLearn addresses each: a domain lock and a clean player keep you focused, quizzes and gap detection check understanding, and the next-lesson engine chooses what comes next.

---

## Feature overview

| # | Feature | What it does |
|---|---|---|
| 1 | Domain-locked feed | Shows only videos from the chosen domain while the lock is on |
| 2 | Distraction-free player | Embeds the video alone, without the YouTube page around it |
| 3 | Video text | Per-video field for a transcript or your own notes |
| 4 | Snapshot bot | Answers questions from text and from attached or pasted screenshots |
| 5 | Smart recommendation | Ranks lessons in your domain against your weak concepts |
| 6 | Quiz generation | Creates 5 multiple-choice questions from a lesson |
| 7 | Knowledge gap detection | Tracks accuracy per concept and flags weak ones |
| 8 | Next best lesson engine | Picks the best unwatched lesson, with a reason |
| 9 | Progress dashboard | Hours studied, lessons watched, quiz scores, milestones |

---

## How to use it

### First run

1. Open the app. The feed is empty.
2. In **Add a lesson**, paste a YouTube link, give it a title, type a domain (for example `Physics`) and optionally add concept tags such as `newton laws, friction`.
3. Click **Add to feed**. The domain becomes your active domain and the lesson opens.

### A typical study session

1. Click **Start focus** to begin the study timer.
2. Watch the lesson in the player.
3. Paste the transcript or your notes into **Video text** (this makes answers and quizzes much better).
4. Stuck on something? Type a question, or attach or paste a screenshot of the frame, and click **Ask**.
5. Click **Mark watched**.
6. Open the **Quiz** tab, generate a quiz, answer, and submit.
7. Open **Gaps & next** to see weak concepts and the recommended next lesson.
8. Open **Progress** to see totals and milestones.
9. Click **Pause focus** when you stop.

---

## Features in depth

### 1. Domain-locked feed

- The **Domain** dropdown selects what you are studying. Preset domains: Maths, Physics, Chemistry, Biology, Coding, Languages. Any domain you type when adding a lesson is added to the list automatically.
- With **Lock feed to this domain** on, the feed lists only lessons in that domain, and you cannot add a lesson in a different domain (you get a message explaining why).
- The lock is yours to control. Turn it off at any time and the feed shows everything and accepts any domain. There are no paywalls, caps on lessons, or limits on questions or quizzes.
- Choosing "All" shows every lesson.

### 2. Distraction-free player

- Uses the privacy-enhanced YouTube embed with related-video and branding options reduced.
- The page around the player contains only the title and a few buttons: no comments, no sidebar, no recommendation grid.
- An **Open on YouTube** link is always shown as a fallback.
- What an embed cannot do: it cannot remove ads that YouTube chooses to serve, and it cannot fully hide end-of-video suggestions. YouTube controls those. See [Known limitations](#known-limitations).

### 3. Video text

- A free-text box under each video stores a transcript or your own notes.
- It is saved as you type.
- It is the main source for the snapshot bot and the quiz generator. The first 12,000 characters are sent to the AI.
- Without text, the AI works from the title and domain only and says when it is guessing.

### 4. Snapshot bot

- Type a question, attach an image with the file picker, or paste a screenshot with `Ctrl+V` / `Cmd+V` while on the Learn tab.
- You can send a question alone, an image alone (the bot then explains what is shown), or both.
- The bot is instructed to answer step by step and concisely, use the transcript when relevant, and say so when the transcript does not cover the question.
- Answers stream in as they are generated.
- Images are used for the single request and are not stored.

### 5. Quiz generation

- Open the **Quiz** tab with a lesson selected and click **Generate quiz from this video**.
- The AI returns 5 multiple-choice questions as structured data: question, four options, correct answer, a short concept label, and a one-sentence explanation.
- After you submit, each question shows whether you were right and why.
- Each submission is saved with the concepts you got right and wrong.
- Unanswered questions count as wrong.

### 6. Knowledge gap detection

- Every quiz question carries a concept label (for example `newton's second law`).
- Across all quizzes, the app computes accuracy per concept.
- Concepts are listed weakest first, with a bar and the number of questions behind the number.
- A concept below **70% accuracy** is treated as a gap and drives the next-lesson pick.

### 7. Next best lesson engine

- Located in the **Gaps & next** tab.
- Takes the lessons in your current domain and prefers unwatched ones.
- Among unwatched lessons, it ranks by how well each matches your gap concepts (see the formula below).
- Shows the recommended lesson with a one-line reason, and an **Open lesson** button.
- If every lesson is watched, it suggests revisiting the best-matching one and retaking its quiz.

### 8. Progress dashboard

- **Studied:** total time on the focus timer.
- **Lessons watched:** watched count out of total.
- **Quizzes:** how many you have submitted.
- **Average score:** mean of quiz percentages.
- **Quiz scores:** bars for your last 12 attempts.
- **Milestones:** First lesson watched, First quiz taken, 1 hour focused, 5 quizzes done, 80% average score (needs at least 3 quizzes), 10 lessons watched.

### 9. Focus timer

- Manual: **Start focus** / **Pause focus**.
- Counts seconds only while running and shows them in the header as hours and minutes.
- Saved every 10 seconds and when paused.
- It measures time you chose to count, not actual playback time.

---

## How the logic works

### Gap detection

```
for each quiz attempt:
    each correct question -> hit[concept]  += 1
    each wrong question   -> miss[concept] += 1

accuracy(concept) = hit / (hit + miss)
gap               = accuracy < 0.70
```

### Next lesson score

```
candidates = lessons in current domain (or all, if no domain)
unwatched  = candidates where watched == false

matches(lesson) = gap concepts that appear in
                  lower-case(title + tags + first 3000 characters of transcript)

score(lesson)   = sum over matches of (1 - accuracy)

pick = unwatched lesson with the highest score
       (a lesson with no matches scores 0, so the first unwatched lesson is chosen)
```

The weaker a matching concept is, the more it contributes. A lesson matching two weak concepts outranks one matching a single mild gap.

### Quiz and answer prompts

- Both send the domain, title and transcript (truncated to 12,000 characters) to the AI.
- The quiz prompt requires JSON only; the result is parsed and the first 8 questions are kept. If parsing fails you see an error and can retry. Nothing fake is substituted.

---

## Data model and storage

All data is stored in the browser's `localStorage` under the key `fl1`, as one JSON object.

```json
{
  "domain": "Physics",
  "locked": true,
  "secs": 5400,
  "v": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Newton's laws",
      "domain": "Physics",
      "tags": ["newton laws", "friction"],
      "tr": "pasted transcript...",
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
  ]
}
```

| Field | Meaning |
|---|---|
| `domain` | Currently selected domain |
| `locked` | Whether the feed is locked to that domain |
| `secs` | Total focus seconds |
| `v[]` | Lessons: YouTube ID, title, domain, tags, transcript, watched flag |
| `q[]` | Quiz attempts: video ID, score, total, concepts right, concepts wrong, timestamp |

Because storage is per browser, clearing site data erases progress and a different browser or device starts empty. There is currently no export. If storage is unavailable, the app still runs for the session.

---

## Architecture

```
+-----------------------------------------------+
|              focus-learn.html                  |
|                                                |
|  State S  <-->  localStorage ("fl1")           |
|     |                                          |
|  render() builds the page from S               |
|     |                                          |
|  Views: Learn | Quiz | Gaps & next | Progress   |
|     |                                          |
|  AI helper (claude sample capability)          |
|     - ask(): text + optional image             |
|     - genQ(): JSON quiz                        |
+------------------+----------------------------+
                   |
     YouTube embed (youtube-nocookie iframe)
```

- **Rendering:** `render()` rebuilds the page from state after each action. Typing in the transcript box saves without re-rendering so the cursor is not lost.
- **Escaping:** every value placed into HTML goes through `esc()`.
- **AI:** the page asks Claude through the platform's `sample` capability. There is no API key in the file. The first AI call asks the viewer for consent. If the helper is unavailable, AI buttons show a clear message and the rest of the app keeps working.

---

## Running and deploying

### Where it runs best

The file as published runs inside Claude as a hosted artifact, which is also what provides the AI helper. Open the link and use it.

### Running it as a plain file

You can open `focus-learn.html` in a browser from disk or host it on any static host (GitHub Pages, Netlify, Cloudflare Pages). Everything except the AI features works. Outside Claude, the AI helper is not available, so the bot and quiz generator will show a message.

### To get AI features outside Claude

Replace the two AI calls (`ask` and `genQ`) with calls to your own backend endpoint that forwards to an LLM provider. Never put an API key in the HTML file. A minimal backend needs two routes: one that takes `{question, transcript, image?}` and returns text, and one that takes `{title, domain, transcript}` and returns the quiz JSON described above.

---

## Customising

All settings are plain constants in the script.

| To change | Where | Notes |
|---|---|---|
| Preset domains | the `domains()` function | Add names to the array |
| Gap threshold | `gaps()` filter in `nextL()` and the `.7` in `gapV()` | Currently 0.70 |
| Questions per quiz | the quiz prompt text and `slice(0,8)` in `genQ()` | Prompt says 5 |
| Transcript size sent to AI | `slice(0,12000)` in `ask()` and `genQ()` | Raise with care (cost and latency) |
| Milestones | the `ms` array in `dash()` | Each entry is a label and a condition |
| Colours and theme | CSS variables at the top of the file | Dark values are under the media query |
| Storage key | `"fl1"` | Change to reset or version stored data |

---

## Privacy and security

- Your lessons, transcripts, quiz results and timer stay in your browser's local storage. The app has no server of its own.
- When you use the bot or generate a quiz, the transcript, your question, and any attached image are sent to the AI service for that request.
- The embed uses the privacy-enhanced YouTube domain, but YouTube still loads inside the page and can set its own cookies once the video plays.
- Transcripts, questions and AI output are treated as untrusted text and escaped before display.
- Do not paste sensitive or confidential material into the transcript box if you do not want it processed by the AI.

---

## Known limitations

These are real gaps in the current version.

1. **Embed behaviour is not fully controllable.** YouTube may still show ads and end-of-video suggestions in an embed. The embed was not verified inside the hosted page, so if the player is blank, use **Open on YouTube**.
2. **No automatic transcripts.** A browser-only page cannot fetch YouTube captions. You must paste text.
3. **No search or discovery.** The feed contains only videos you add. "Recommendation" ranks your own library, not YouTube as a whole.
4. **Concept names are free text.** The AI labels concepts itself, so near-duplicates (`newton's laws` vs `newtons laws`) can split one concept into two and weaken gap statistics.
5. **Quiz quality depends on the text you give.** Without a transcript, questions are generic.
6. **Timer is manual.** It does not know whether a video is actually playing.
7. **"Mark watched" is manual**, not detected from playback.
8. **Removing a lesson keeps its old quiz history**, which still counts in gaps and averages.
9. **Quiz answers are not saved until you submit.** Reloading mid-quiz loses the quiz.
10. **Local only.** No accounts, no sync across devices, and no export or import yet.
11. **AI answers can be wrong.** Check important answers against your course material.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Player is blank | Embed blocked or video disallows embedding | Click **Open on YouTube** |
| "Paste a valid YouTube link" | Link not recognised | Use a `watch?v=`, `youtu.be/`, `embed/` or `shorts/` link, or the 11-character ID |
| "Feed is locked to …" | Lock on and domain differs | Switch domain or untick the lock |
| "AI helper is not available" | Page opened outside Claude, or permission declined | Open the hosted link, or accept the consent prompt |
| "Quiz generation failed" | Malformed AI response or rate limit | Click generate again after a moment |
| Progress vanished | Browser data cleared, different browser or private window | Use the same browser profile; export is on the roadmap |
| Next lesson is just the first unwatched one | No weak concepts or no tag/transcript matches | Add concept tags and transcripts, and take more quizzes |

---

## Manual test checklist

Run these after any change.

- [ ] Add a lesson with a valid link; it appears and opens.
- [ ] Add with an invalid link; an error appears.
- [ ] With the lock on, adding a lesson in another domain is blocked with a message.
- [ ] Unlock, add it again; it works.
- [ ] Switch domain; the feed changes and the selection clears.
- [ ] Paste a transcript, reload; the text is still there.
- [ ] Ask a text question; an answer streams in.
- [ ] Attach an image and ask; the answer refers to the image.
- [ ] Paste a screenshot with the keyboard; the thumbnail appears.
- [ ] Generate a quiz; 5 questions render.
- [ ] Submit with some wrong answers; score and explanations show.
- [ ] Open **Gaps & next**; wrong concepts appear below 70%.
- [ ] The recommended lesson changes after adding a lesson tagged with a weak concept.
- [ ] Start and pause the timer; the time on **Progress** matches.
- [ ] Reload the page; everything persists.
- [ ] Switch your system between light and dark; both look correct.
- [ ] Open on a phone-width screen; nothing scrolls sideways.

---

## Roadmap

**Near term**
- Export and import progress as a JSON file.
- Normalise concept names so near-duplicates merge.
- Save quiz progress before submission.
- Delete a lesson's quiz history together with the lesson.
- Detect real playback time with the YouTube player API to drive the timer and "watched".

**Medium term**
- A small backend that fetches transcripts automatically and proxies AI calls, so the app works outside Claude.
- Accounts and cloud sync (for example Postgres with token auth).
- Spaced repetition on weak concepts (SM-2 style scheduling) so gaps come back for review at the right time.
- Curated lesson libraries per domain, with difficulty levels and prerequisites for a real learning path.

**Longer term**
- Teacher and parent views of student progress.
- Shared study groups and focus sessions.
- Question banks reviewed by humans, with the AI used for variations.

---

## FAQ

**Is it free to use? Are there limits?**
There are no limits or paywalls in the app itself. AI usage is governed by the platform that provides the AI helper.

**Does it work offline?**
Partly. The interface and your saved data work offline, but the player and the AI features need internet.

**Can I use it for subjects other than school topics?**
Yes. A domain is any name you type: guitar, cooking, a language, a programming framework.

**Why does the bot sometimes say the transcript does not cover my question?**
It is instructed to be honest about that and then answer from general knowledge. Pasting a fuller transcript gives better, more grounded answers.

**Why did my recommended lesson not change?**
Recommendations depend on tags, titles and transcripts matching your weak concepts. Add specific tags and take more quizzes.

**Can several people share one copy?**
Each browser keeps its own data. For shared or synced progress you need the accounts and backend work on the roadmap.

**Will it replace a teacher or course?**
No. It is a focus and practice aid. Verify important answers with a trusted source.
