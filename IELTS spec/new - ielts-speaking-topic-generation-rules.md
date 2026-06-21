# IELTS Speaking — Topic Generation & Linking Rules

**For the examiner engine.** How the app chooses and phrases questions across the three parts, with the key structural rule:

> **Part 1 stands alone. Parts 2 and 3 share one theme** — Part 3 takes the concrete Part 2 cue-card topic and escalates it into abstract, general discussion.

This file covers the **generation rules** (not a fixed question bank) plus a few worked examples to illustrate them. For timing, scoring and the full app pipeline, see the main Speaking app build spec; the essentials needed for generation are repeated here so this file stands on its own.

---

## 1. The core principle

| Part | Topic source | Relationship |
|---|---|---|
| Part 1 | Its own familiar, everyday topics | **Independent** — unrelated to Parts 2 & 3 |
| Part 2 | A single concrete cue-card topic | **Theme anchor** for Part 3 |
| Part 3 | Abstract questions derived from the Part 2 theme | **Linked** — deepens and generalises Part 2 |

So the generator runs two separate tracks: **Track A** picks Part 1 topic sets; **Track B** picks one Part 2 theme and grows Part 3 out of it.

---

## 2. Part 1 — standalone topic generation (Track A)

**Goal:** ease the candidate in with simple questions on familiar, personal topics. No link to Parts 2–3.

**Rules:**
- Choose **2–3 topic sets** for the ~4–5 minute window.
- The **first set is always the candidate's own life**: home/accommodation, hometown, work, or studies. (Real tests open here.)
- Remaining sets come from everyday/familiar areas: daily routine, food, weather, hobbies, music, sport, transport, shopping, holidays, friends, technology in daily life, etc.
- Each set has **3–4 short questions**, moving from simple fact to light opinion (e.g., "Do you…?" → "Why do you…?" → "Has that changed?").
- Keep questions **concrete and personal** — about the candidate's own experience, not society at large. That abstraction is saved for Part 3.

**Do:** keep answers flowing; ask natural follow-ups; vary the topics.
**Don't:** go abstract; ask for extended argument; reuse a Part 1 topic as the Part 2 theme; let any single answer run long.

---

## 3. Part 2 — cue-card generation (Track B anchor)

**Goal:** give one concrete topic the candidate can speak about alone for 1–2 minutes, drawing on personal experience.

**Cue-card anatomy (always this shape):**
```
Describe [a specific thing].
You should say:
  - [point 1]
  - [point 2]
  - [point 3]
and explain [why / how — one reflective aspect].
```

**Card categories** (pick one): a **person**, a **place**, an **object/possession**, an **event/experience**, an **activity/habit**, or a **media item** (book/film/app). These cover the common real-test range.

**Phrasing rules:**
- The main prompt names something **specific and personal** ("a teacher who influenced you", not "education").
- The three points are easy prompts to structure the talk (who/what/when/where/how).
- The final "and explain…" forces **reflection or feeling**, which feeds naturally into Part 3.
- Keep it **culturally neutral and universally answerable** (see §6).

**Timing the generator must enforce:** show the card; run a strict **60-second prep timer** with a notes field; run a **2-minute talk timer**; if the candidate stops before ~90 seconds, prompt once to continue; then ask **1–2 short follow-up questions** still tied to the card.

---

## 4. Part 3 — linked discussion generation (Track B growth)

**Goal:** a two-way discussion of **abstract, general** issues that grow out of the Part 2 theme, probing opinion, analysis and speculation.

### The transform (concrete → abstract)
Take the Part 2 theme and shift it along these axes to generate questions:

| Axis | Part 2 (concrete) | Part 3 (abstract) |
|---|---|---|
| Scope | One person/place/thing in the candidate's life | People in general, society, groups |
| Angle | Describe / narrate | Evaluate, compare, explain causes, weigh pros/cons |
| Time | Now / their experience | How it has changed; how it may change in future |
| Agent | The individual | Society, government, schools, employers, technology |

**Worked transform example.** Part 2 = "a teacher who influenced you" → theme = **education / teaching**. Part 3 questions:
- *Opinion:* What qualities make someone a good teacher?
- *Compare (time):* How has teaching changed compared with the past?
- *Society/agent:* Whose responsibility is a child's education — schools or parents?
- *Evaluate:* Can online learning ever replace a real teacher?
- *Speculate:* How might classrooms look in the future?

### Question-function mix
Across Part 3, vary the **function** of questions so the candidate must do different things:
opinion · agree/disagree · compare (then vs now, young vs old) · advantages/disadvantages · causes · effects · solutions · future speculation · hypotheticals.

### Probing
Follow each answer with a short probe to push for extension and reasoning:
"Why do you think that?" · "Can you give an example?" · "Do you think that will change?" · "Does everyone feel the same way?" · "Is that true everywhere?"

### Rules
- **Stay on the Part 2 theme** — every Part 3 question must trace back to it.
- Move from **easier to harder** (a broad opinion first, then comparison/causation, then speculation).
- Ask **one question at a time**; adapt the next probe to what the candidate actually said.
- Keep questions **open** (never yes/no without a follow-up "why").

---

## 5. The 2→3 linking algorithm (what the app does)

```
1. Pick a Part 2 card category and a specific, neutral topic.
2. Extract the THEME from it (e.g. card "a useful piece of technology" → theme "technology in daily life").
3. Generate 4–6 Part 3 questions by applying the transform axes (§4) to the theme:
     - 1 opening opinion question (broad, easy)
     - 1–2 comparison / change-over-time questions
     - 1–2 society / cause / evaluation questions
     - 1 future-speculation or hypothetical question
4. Attach a short probe to each (chosen at runtime from the probe list).
5. Sequence easy → hard.
6. (Part 1 is generated independently via Track A — no shared theme.)
```

---

## 6. Generator guardrails

- **Fairness / neutrality.** Topics must be answerable by anyone regardless of country, religion, politics, wealth, or background. Avoid culture-specific knowledge, sensitive politics, religion, and anything distressing. A candidate's weak performance should never be caused by an unfair topic.
- **Difficulty ramp.** Part 1 easy and personal → Part 2 sustained but concrete → Part 3 abstract and demanding.
- **Independence rule.** Never reuse the Part 1 topic as the Part 2/3 theme.
- **Theme integrity.** Every Part 3 question must connect to the Part 2 card.
- **Examiner tone.** Friendly and conversational, not formal or academic. One question at a time. Let the candidate finish.
- **No coaching.** During the test the examiner never corrects, hints, or signals approval/disapproval. Feedback comes only at the end.
- **Timing.** Part 1 ~4–5 min · Part 2 ~3–4 min incl. 60s prep + 2-min talk · Part 3 ~4–5 min · total ~11–14 min.

---

## 7. A few worked example themes

Each shows Part 1 (independent sets) alongside the linked Part 2 → Part 3 thread.

### Example A — theme: education
- **Part 1 (separate):** Hometown · Daily routine · Music
- **Part 2 card:** *Describe a teacher who has influenced you. You should say: who they are; what they taught you; how they influenced you; and explain why this influence has stayed with you.*
- **Part 3 (linked):** What makes a good teacher? · How has teaching changed compared with the past? · Should education be the job of schools or parents? · Can online learning replace classroom teachers? · How might classrooms change in the future?

### Example B — theme: relaxation / lifestyle
- **Part 1 (separate):** Work or studies · Weather · Food
- **Part 2 card:** *Describe a place where you like to relax. You should say: where it is; how often you go there; what you do there; and explain why it helps you relax.*
- **Part 3 (linked):** Why do people feel more stressed today? · Are public spaces for relaxing important in cities? · How do people's ways of relaxing differ by age? · Is work–life balance harder now than before? · Will cities become more or less relaxing places to live?

### Example C — theme: technology in daily life
- **Part 1 (separate):** Accommodation · Hobbies · Travel
- **Part 2 card:** *Describe a piece of technology you find useful. You should say: what it is; how you use it; how long you've had it; and explain why it's so useful to you.*
- **Part 3 (linked):** How has technology changed the way people communicate? · What are the downsides of depending on technology? · Does technology bring people together or push them apart? · Should there be limits on children's screen time? · What kind of technology might we rely on in twenty years?

---

## 8. Build notes (for Claude Code)

- Implement **two generators**: `generatePart1()` (independent topic sets) and `generateLinkedTheme()` (returns a Part 2 card + a sequenced Part 3 question list from one theme).
- Store a **theme object** so Part 2 and Part 3 stay tied: `{ theme, card, part3_questions[], probes[] }`.
- Keep a tagged pool of **card categories** and **familiar Part 1 topics**; select with no-repeat logic within a session.
- Generate Part 3 by **rule, not by hand** — apply the transform axes to whatever theme is chosen, so any new card automatically yields a matching discussion.
- Enforce the timers and the "one question at a time / no coaching" rules in the interview loop, not just in the prompt.
