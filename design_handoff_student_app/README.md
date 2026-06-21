# Handoff: English with Laura — Student App (visual redesign)

## Overview
A visual redesign of the **student-facing** surface of the English with Laura learning
platform (the existing Next.js app `laura646/flashcards`). This package covers the full
student journey: course home, lesson detail, the vocabulary trainer, word list, add-a-word,
quiz + results, the flip/quiz/self-assess flashcards, the comprehension exercises
(read / listen / match), plus loading. The **teacher / admin** surface is out of scope and
will be handled in a later pass.

The redesign keeps the product's information architecture but moves it onto a refreshed,
single, locked visual direction (internally "10B"): a solid sky-blue hero, the white
English-with-Laura logo, Rubik type, and a tight, universal component kit.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes that show
the intended look and behaviour. They are **not** production code to copy directly, and they
are authored in a small in-house templating runtime (`.dc.html` + `support.js`); ignore that
wrapper. **The task is to recreate these designs in the existing codebase** (`laura646/flashcards`,
Next.js 16 + Tailwind) using its established components, Tailwind tokens, and patterns. Lift the
exact colours, type, spacing, and copy documented below; implement behaviour with the app's
existing state and data layer.

Each screen is a `~372px`-wide phone frame in the prototype. Build mobile-first
(the product is `max-w-lg`, single column).

## Fidelity
**High-fidelity.** Final colours, typography, spacing, corner radii, and interactions are all
specified. Recreate pixel-faithfully using the codebase's Tailwind setup. Where a value below
maps cleanly to an existing Tailwind token, prefer the token.

---

## Design tokens

### Colour
| Token | Hex | Use |
| --- | --- | --- |
| Sky / primary | `#00aff0` | Hero fill, primary buttons, active icons, eyebrows, progress fill, links |
| Brand blue | `#416ebe` | The vocab **word**, screen/section headings, lesson titles |
| Yellow | `#ffeb00` | Streak chip background only (sparingly) |
| Streak text-on-yellow | `#5a4b00` | Text/icon on the yellow streak chip |
| Sky wash | `#e6f6fe` | Quick-action tiles, chips, segmented track, audio-circle fills |
| Sky border | `#cfeafb` | 1.5px borders on light-sky elements, audio circle outline |
| Text | `#46464b` | Body text, on-light-blue text (see colour rule) |
| Near-black | `#15161a` | Question text, list item titles, meaning text |
| Muted | `#8b8f98` | Metadata, captions, subtitles |
| Hairline | `#ececef` | Card borders, dividers |
| Surface | `#f6f8fb` | Quiz sub-question panels |
| Correct fg / bg / border | `#16a34a` / `#e7f7ee` / `#c3ebd4` | Correct answer states |
| Incorrect fg / bg / border | `#e5484d` / `#fdecec` / `#f6cdcf` | Wrong answer states |
| Periwinkle (rating "Hard") | `#eef0fb` bg / `#6a6fb0` fg | Spaced-repetition "Hard" button |
| Leitner ramp | `#e7eaf0` → `#ffeb00` → `#7fd4f5` → `#00aff0` → `#416ebe` | New→Learning→Familiar→Known→Mastered |

**Locked colour rule:** never place dark-blue (`#416ebe`) text or icons on a light-blue
surface (`#e6f6fe`). On light-blue, text is grey `#46464b`. Solid sky `#00aff0` fills are fine.

### Typography
- **Rubik** (Google Fonts), weights 400/500/600/700/800/900. (This replaces the legacy Lato
  in the current app — confirm with Laura before changing the global font.)
- Word (flashcard): 40px / 900, `#416ebe`, letter-spacing −0.01em.
- Screen heading: 19–21px / 800, `#416ebe`.
- Hero number ("210"): 42px / 800, white, letter-spacing −0.02em.
- Section heading: 16px / 800.
- Eyebrow (WORD / MEANING / EXAMPLE / TRUE OR FALSE): 11–12px / 800, UPPERCASE,
  letter-spacing .1em — sky `#00aff0` (MEANING/WORD) or brand-blue `#416ebe` (EXAMPLE).
- Body: 14–15px / 500–600. Metadata: 12px / 600 muted. Phonetic: 13px monospace, muted.

### Spacing, radius, elevation
- Phone content gutter: 20–22px. Card padding: 15–18px (lists), 24px (flashcards).
- Radius: tiles/inputs 12–16px, cards 18px, flashcard 22px, pills/chips `999px`,
  phone screen 34px.
- Borders: 1px `#ececef` default; 1.5px `#cfeafb` on light-sky; 2px `#00aff0` on the flashcard.
- Shadows: near-flat. Cards use only a faint border; the phone frame uses a soft drop shadow.
- Min tap target ≈ 44px.

### Motion (locked set — see `EWL Animations.dc.html` & `EWL Universal Elements.dc.html`)
| Name | What | Spec |
| --- | --- | --- |
| Flashcard flip | front→back | 3D `rotateY(180deg)`, ~550ms, `preserve-3d` + `backface-visibility:hidden` |
| Correct | pulse | scale to 1.05 + green glow ring, ~1.5s |
| Wrong | shake | ±6px horizontal translate, ~1.5s |
| Progress | fill | width 0→target, ease-in-out |
| Leitner | grow | bars rise from 0, staggered ~120ms |
| Points | odometer roll | number column rolls to next value, spring ease |
| Audio (playing) | equalizer | 4 sky bars scaleY .35↔1, staggered 150ms |
| Loading | bouncing dots | 3 white dots, translateY −10px, staggered 150ms |
Keep everything else calm — no parallax, no page-transition flourishes beyond a simple slide.

---

## Screens / views

> Common chrome: a status bar row (9:41 / signal / 100%) at the very top of each phone; a
> back affordance top-left ("← Back" or "← Back to lesson", 14px/600 muted). The Home screen
> has a bottom tab bar; inner screens do not (matches current product).

### 1. Home (course home)
- **Purpose:** daily landing — see words due, jump into review/practice, resume lessons.
- **Layout (top→bottom):**
  1. **Sky hero** (`#00aff0`, 14/22px padding, no bottom radius): status bar; row with the
     **white logo** (`assets/logo-onblue.png`, ~54px tall) and a **streak chip** (yellow
     `#ffeb00` pill, `#5a4b00` text, energy-bolt icon + "1"); "Welcome back, Anahit" (14/500,
     90% white); then a baseline-aligned row of **"Words to review" + "210"** (42/800) on the
     left and a white **"Start review"** button (`#fff` bg, `#46464b` text, 800) on the right.
  2. **Quick actions** — 3 equal sky-wash tiles (`#e6f6fe`, radius 14): Flip / Quiz / Add word,
     each a centered line icon (`#00aff0`) over a 12/700 `#46464b` label.
  3. **Course block** — "← My courses" (12/600 muted) then a book icon + **"A1.1-G2 · Sveta"**
     (19/800 `#416ebe`); below it a hairline card with chip rows: Beginner · Tue·Thu·Fri
     (icon + `#46464b`), and Join lesson · Telegram (icon + `#00aff0`).
  4. **Recent lessons** — section header "Recent lessons" (16/800) + "All" link (`#00aff0`).
     Each lesson card (hairline, radius 18): a solid sky **"Lesson 9"** pill + date (12/600
     muted) + chevron; title (15/700, `#416ebe` if active else `#15161a`); "33 words · 0/2
     exercises" (12/600 muted); a thin progress bar (track `#eef1f6`, fill `#00aff0`).
  5. **Bottom tab bar** — hairline top border, 4 line icons (home active `#00aff0`, rest `#c8ccd4`).

### 2. Lesson detail
- **Purpose:** overview of one lesson + its activities.
- **Layout:** back link; an info card (date 12/600 muted, title 21/800 `#416ebe`, one-line
  description `#6b7280`); a **progress card** ("Your progress" 14/800 + "1 / 3" `#00aff0`, with
  three segment bars — filled = `#00aff0`, empty = `#eef1f6`); **Activities** list — each row a
  hairline card with a sky-wash icon tile, title (15/700), subtitle (12/500 muted), chevron.
  The current/next activity card uses a 2px `#00aff0` border + `#416ebe` title.

### 3. Vocabulary Trainer
- **Purpose:** hub for review, quiz, and word stats.
- **Layout:** back link + "Vocabulary Trainer" (20/800 `#416ebe`); a **streak card** (hairline,
  sky-wash icon tile `#e6f6fe` with energy-bolt `#00aff0`, "1-day streak" 15/800 + subtitle);
  a **"Words due for review"** card (solid `#00aff0`, white text, "210" 40/800, two buttons:
  "Flip review" translucent-white, "Quiz review" solid-white `#46464b`); a **Leitner card**
  ("Your words — 257 total" eyebrow; a 5-bar chart with the Leitner ramp colours and counts/
  labels New/Learning/Familiar/Known/Mastered — leave clear space above the bars); a button
  row: "Refresh" (sky-wash) + "+ Add word" (white, hairline border).

### 4. Word list
- **Purpose:** browse all words in scope.
- **Layout:** back link + "New" pill + "193 words" (18/800 `#416ebe`); a full-width primary
  button "Review these 193 words now" (`#00aff0`); a hairline card list — each row: word
  (15/700) + small audio circle (outline `#cfeafb`, speaker `#00aff0`), an "Edit" link
  (12/600 `#c2c8d2`) right-aligned, and a one-line definition (12/500 `#6b7280`).

### 5. Add a word
- **Purpose:** add a custom vocabulary entry.
- **Layout:** back link + "Add a word" (18/800 `#416ebe`); four fields (Word* / Meaning /
  Phonetic / Example) — each an UPPERCASE eyebrow label + an input (1.5px `#e3e5e9`, radius 14,
  placeholder `#b6bac2`; focused state uses a sky eyebrow + 1.5px `#00aff0` border); a full-width
  primary "Add word" button.

### 6. Universal flashcard (used by New Words flip **and** Vocabulary Review)
- **One card design for both flows.** Card: white, **2px `#00aff0`**, radius 22, 24px padding.
- **Front:** status pill (solid `#00aff0`, white — e.g. "New"/"Learning") · **WORD** eyebrow
  (sky) · the word (40/900 `#416ebe`) · uppercase headword + audio circle · "tap to flip"
  (13/500 `#b9c0cc`), centered.
- **Back (left-aligned):** a row of [status pill] + word (18/800 `#416ebe`); **MEANING** eyebrow
  (sky) + meaning (16/600 `#15161a`); a hairline divider; **EXAMPLE** eyebrow (brand-blue) +
  italic example (14/500 muted); an audio circle.
- Above the card on these screens: header (New Words + "7 words" pill), a **segmented control**
  (sky-wash track, active tab = white pill w/ soft shadow + `#416ebe` label: Flip / Self-Assess
  / Quiz), and a progress row (thin bar + "1 / 7").
- **Next →** button: full-width solid `#00aff0`.
- **Vocabulary Review** adds, below the card, the spaced-repetition rating row (see component).

### 7. Quiz + result
- **Quiz:** back link + "Write number words" (16/800 `#416ebe`) + "2 / 12"; thin progress bar
  (`#00aff0`); "Question 2" (13/700 muted) + the prompt "12 = ___" (32/800 `#416ebe`); four
  answer options (see answer-state component); an inline feedback strip; full-width "Next →".
- **Result:** a sky-wash rounded icon tile; "Keep practising!" (23/900 `#416ebe`); "You scored
  9 / 12 (75%)"; a list of missed items (each in an incorrect-bordered card: prompt, then
  struck-through wrong pick → correct answer in green); buttons "Start again" (outline) +
  "Back to lesson" (solid `#00aff0`).

### 8. Comprehension exercises (Read / Listen / Match)
- **Read & Understand:** back-to-lesson; doc icon + "Read & Understand" (19/800 `#416ebe`) +
  sub-lesson; a reading passage card (`#46464b`, line-height 1.6); "Comprehension exercises"
  (16/800 `#416ebe`); a card with a "TRUE OR FALSE" eyebrow (sky, with a check icon) and
  per-question panels on `#f6f8fb` — statement + True/False buttons + a "Check" button
  (small solid `#00aff0`); answered states use the correct/incorrect colours.
- **Listen & Understand:** same, but the top card is an **audio player** — a solid `#00aff0`
  circular play button, "0:00 / 0:44", a sky-wash scrubber with `#00aff0` fill, a volume icon.
- **Match verbs with objects:** instruction (italic muted); a "TAP OR DRAG TO MATCH" card with
  draggable verb chips (sky-wash `#e6f6fe`, 1.5px `#cfeafb`, `#46464b` text); a list of target
  rows (dashed `#c8d2e0` drop slot + object label); a full-width "Submit answers" (`#00aff0`).

### 9. Loading
- Full sky `#00aff0` screen, centered white logo, three bouncing white dots.

---

## Components (the canonical kit)
See `EWL Universal Elements.dc.html` for live specimens of every item below.
- **Buttons:** Primary (solid `#00aff0`, white, 800, radius 16); Secondary (white, 1.5px
  `#cfeafb`, `#0089c4` text); Neutral (`#f4f5f7`, `#46464b`); Check (small solid sky); Text-link
  (`#00aff0` + arrow); Disabled (primary at .45 opacity); On-hero white (white bg, `#46464b`).
- **Spaced-repetition rating (4):** Again `#f1f2f4`/`#6b7280` · Hard `#eef0fb`/`#6a6fb0` ·
  Good `#e6f6fe`/`#0089c4` · Easy solid `#00aff0`/white. Each: bold label + tiny caption.
- **True/False:** two equal outline buttons (1.5px `#cfeafb`, `#46464b`); answered → correct/
  incorrect colours.
- **Pills/badges:** status (solid sky), level & word-count (sky-wash `#e6f6fe`/`#46464b`),
  lesson (solid sky), streak (yellow + bolt), correct/incorrect chips.
- **Inputs:** default + focused (sky eyebrow + `#00aff0` border).
- **Audio:** outline circle (`#cfeafb`) with speaker; playing → equalizer of 4 sky bars.
- **Segmented control, progress bar, Leitner bars, quiz answer states, lesson card, tab bar.**

## Interactions & behaviour
- **Flashcard:** tap toggles a 3D Y-flip (~550ms) between front and back.
- **Quiz/exercise answer:** on select, lock options; correct option → green (pulse), chosen
  wrong → red (shake), reveal inline feedback + enable Next.
- **Spaced repetition:** Again/Hard/Good/Easy advances to the next card and feeds the review
  scheduler (reuse the existing Leitner logic in the codebase).
- **Progress bars / Leitner bars / points:** animate to value on mount/update (fill, grow,
  odometer roll).
- **Audio button:** shows the equalizer animation while the clip plays.
- **Nav:** lesson cards → Lesson detail; activities → the matching exercise/flashcard screen;
  Home tab bar switches top-level sections.

## State (reuse existing app state where possible)
- Current course/lesson; per-lesson progress (studied / exercises / words).
- Words-due count + streak count; Leitner bucket counts; points + next-tier threshold.
- Flashcard index + flipped flag + mode (Flip/Self-Assess/Quiz); quiz index + answered/selected
  + score + missed list; per-exercise answered/correct state; audio play state.

## Assets
- `assets/logo-onblue.png` — white wordmark + yellow speech-bubble logo, for use on the sky hero
  and loading screen (do **not** recolour).
- `assets/logo-white.png` — white line-art logo (alternate, dark backgrounds).
- `assets/logo-color.png` — full-colour logo (light backgrounds).
- Icons are inline SVG line icons (2px stroke, rounded caps), in the AudioButton house style —
  no icon font. Use the codebase's icon approach (or Lucide) to match.

## Files in this bundle
- `EWL Student App.dc.html` — all student screens in the final 10B direction (primary reference).
- `EWL Universal Elements.dc.html` — the component/style kit (buttons, pills, inputs, cards,
  flashcard, quiz states, animations).
- `EWL Animations.dc.html` — the locked motion set with annotated specs.
- `assets/` — the logos listed above.

> To preview a `.dc.html` file in a browser you also need its sibling `support.js` runtime; the
> markup and inline styles are the source of truth regardless.
