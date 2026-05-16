# English with Laura — App UI Refresh Design Brief

> **For:** a UI designer (human or Claude-design).
> **Goal:** make the student-facing app **~30% more colourful, fun and engaging** — while staying **minimalist**, professional, and highly readable. This is an **evolution of the existing design system**, not a redesign. Layouts and structure stay; colour, accent, typography and the gamification "skin" get refreshed.

---

## 1. North star

The brand reference is the new marketing site: **https://english-with-laura-dcaf1b.webflow.io/**

The app should feel like the *same brand family* as that site — same palette, same type personality, same clean-but-modern energy. Pull colour and typographic cues from it.

## 2. Audience & tone

- **Students are adults, ~25–45.** Professional, busy, learning English.
- Target playfulness = **~50% of Duolingo.** Friendly, encouraging, lightly gamified, a bit of delight on wins — but **never childish, never loud.** Think "energetic and modern," not "cartoon."
- Keep the current **emoji** style for icons/illustration (🔥 🧠 🎯 ✅ etc.) — cheap, friendly, on-tone. No custom mascot or illustration system.

## 3. What "30% more colourful" means (concrete)

Today the app is ~85% neutral (white/grey) with a single blue accent. The refresh:

- Keep **white / off-white as the canvas** (minimalism preserved — colour is the *accent*, never the background of everything).
- **Sky blue `#00aff0` becomes the dominant accent** (replacing `#416ebe` as the primary). `#416ebe` stays as a supporting/deeper tone.
- Introduce a **small, disciplined accent palette** (below) so different *meanings* get different colours — more colour, but every colour carries meaning. That's how it gets brighter without getting messy.
- **Gamification elements become the colourful centrepieces** (streaks, SRS mastery stages, points, progress, celebration moments).
- Net effect target: roughly **30% more coloured surface area**, concentrated in interactive + motivational elements, not in body text or data tables.

## 4. Colour system

### Core palette (hex — sourced from the brand site)

| Token | Hex | Role |
|---|---|---|
| **Sky** (primary accent) | `#00aff0` | Dominant brand accent — primary buttons, links, active states, focus, key highlights |
| **Deep blue** | `#0050bd` | Strong emphasis, primary CTA gradients, headers paired with Sky |
| **Classic blue** (existing) | `#416ebe` | Supporting tone, secondary accents, retained for continuity |
| **Mint** (success) | `#50d890` | Success, correct answers, "Mastered", positive progress — **always positive, never decorative** |
| **Amber** | `#f5a623` (or current amber) | Streaks 🔥, "due for review", in-progress, attention — energy without alarm |
| **Violet** (delight) | `#6941c6` | Celebratory / achievement accents, used **sparingly** for "fun" moments |
| **Error red** | `#ef4444` | Errors & destructive actions **ONLY** — never decorative (hard rule) |
| Ink | `#1a1b1f` | Primary text / headings |
| Slate | `#758696` | Secondary text |
| Mist | `#e4ebf3` | Borders, dividers, subtle card outlines |
| Cloud | `#f5f7fa` | Section / card backgrounds |
| White | `#ffffff` | Page canvas |

### Semantic rules (the discipline that keeps it minimalist)

1. **Every colour means something.** Nothing is coloured "just to be colourful."
   - Sky/Deep blue = primary action & brand identity
   - Mint = success / correct / mastered (only)
   - Amber = streaks, due, in-progress, warnings
   - Violet = achievements & celebratory delight (sparing)
   - Red = errors / destructive (only)
2. **Neutrals do the heavy lifting.** Text, structure, and most backgrounds stay neutral. Colour is the highlight, not the wallpaper.
3. **One dominant accent per screen.** Sky blue leads; other accents are supporting players, not competing.

### Signature gradient — Vocabulary / SRS feature

The Vocabulary Trainer is the app's "fun, personal" zone — give it a signature **blue → sky-blue gradient** echoing the site's hero text ("to a brand-new"):

```
linear-gradient(135deg, #416ebe 0%, #00aff0 100%)
```

Optional 3-stop "hero echo" for the most special moments (streak celebration, mastery): lead with a violet hint —
```
linear-gradient(135deg, #6941c6 0%, #3b82f6 45%, #00aff0 100%)
```

Use the gradient as the *identity* of vocabulary/SRS surfaces (the "words due" card, trainer header, streak banner, stage bars). Do **not** spray gradients everywhere — it's the SRS signature, used deliberately.

## 5. Typography

The site uses **Exo** for display/headings and **Google Sans** for body. Recommendation:

- **Headings → Exo** (free on Google Fonts; matches the site exactly). Weights 600/700/800. Geometric, modern, confident.
- **Body → Inter** (free; the closest high-quality stand-in for the proprietary Google Sans — clean, neutral, excellent legibility at small sizes). *Manrope* is an acceptable alternative.
- The app currently uses **Lato** — replace with the Exo + Inter pairing.
- Keep type **large and confident** like the site's hero (big bold headings, generous line-height, comfortable body size — readability first).

## 6. Per-surface guidance (student app only)

| Surface | Refresh direction |
|---|---|
| **Home (`/home`)** | "Words due" card → signature gradient. Greeting more lively. Points pill brighter (amber/violet). Lesson cards: keep clean, add a subtle Sky accent on progress + status. |
| **Lesson player / exercises** | Keep structure. Correct = Mint, wrong = Red, neutral states stay calm. Progress bars → Sky. Success/finish screens → a small celebratory moment (violet/mint, confetti-light, not loud). |
| **Vocabulary Trainer** | The colourful flagship. Gradient identity. Stage bars (New→Mastered) become a vibrant but ordered spectrum. Streak banner = warm amber→gradient. Focus words = amber attention. |
| **Flashcards** | Card faces stay clean & readable (text is the point). Accent the chrome (buttons, progress, audio button) with Sky. |
| **Empty / loading states** | Keep the playful "Crickets 🦗" voice. Add gentle colour to illustrations/emoji framing. |
| **Buttons** | Primary = solid Sky (or Sky→Deep gradient for the biggest CTAs). Secondary = outline Sky. Keep current radius/shape. |

## 7. Hard constraints

- ✅ **Readability is non-negotiable.** All text/background combinations must meet **WCAG AA** (4.5:1 normal text, 3:1 large text). When a colour fails contrast, the colour loses — adjust or use it only as a non-text accent.
- ✅ **Minimalism preserved.** More colour, same calm. If a screen starts to feel busy, pull colour back to neutrals + one accent.
- ✅ **Evolution only.** Do **not** change layouts, navigation, component structure, or information architecture. Same screens, refreshed skin.
- ✅ **Emoji stay.** No new illustration system.

## 8. Explicitly out of scope

- ❌ Dark mode (skipped for now)
- ❌ Admin / teacher / superadmin UI (stays clean & professional — this brief is **student-facing only**)
- ❌ Layout / structural / navigation changes
- ❌ Custom illustrations, mascot, or icon set (keep emoji)

## 9. Deliverables expected back from design

1. A finalised colour token table (any hex adjustments for contrast compliance noted).
2. The Exo + Inter type scale (heading sizes/weights, body sizes, line-heights).
3. 3–5 key screen mockups for *direction* (recommend: Home, Vocabulary Trainer, a lesson exercise, the finish/celebration screen, an empty state).
4. The signature gradient finalised + where it is/isn't allowed.

Implementation then proceeds **system-first** (shared colour tokens + Tailwind config + type), then screen-by-screen behind preview deploys — not as a hand-translated pixel copy.

---

*Brief generated from: Laura's stated preferences + the brand site's extracted CSS design tokens (fonts: Exo / Google Sans; palette incl. `#00aff0`, `#0050bd`, `#416ebe`, `#50d890`, `#6941c6`, `#1a1b1f`, `#e4ebf3`, `#f5f7fa`).*

---

# Appendix A — Complete Student-App Interface Inventory

> This section gives a designer who has never seen the app full context: every student-facing screen, its purpose, its components, and its states. Design refreshed visuals for **all of these**. (Admin/teacher/superadmin screens are intentionally excluded — out of scope.)

The app is a mobile-first web app (max content width ≈ 512px / `max-w-lg`, centred). Treat phone as the primary form factor; it should also look good on desktop (centred column).

## A1. Auth & entry

**Landing / Login (`/`)** — Logo, brand line, email+password sign-in, link to sign-up and forgot-password. First impression — should feel modern and trustworthy (match the marketing site's hero energy).

**Sign up (`/signup`)** — Name, email, password; may include a course invite code. Same visual language as login.

**Forgot password / Reset password** — Minimal single-purpose forms (email field → confirmation; new-password field → success). Calm, simple.

**Join course (`/join/[code]`)** — A student opens an invite link; confirms joining a named course. Short, welcoming, one primary action.

## A2. Home (`/home`)

The student's hub. Two states:

- **No courses yet (`NoCourses`)** — Friendly empty state with an invite-code entry field ("ask your teacher for a code"). Encouraging, not cold.
- **Has courses** — Header: logo, "Welcome back, {name}", a **points pill** (⭐ total points; currently amber gradient). Then:
  - **VocabDueCard** — the prominent daily-review nudge: "🧠 N words due for review", with a 🔥 streak chip and loss-aversion copy; or a calm "✅ all caught up" variant. **This card is the flagship of the colour refresh — give it the signature gradient.** One tap → Vocabulary Trainer.
  - **Course selector** (only if the student has multiple courses) — list of course cards.
  - **Lesson list** — one card per lesson: lesson number/type badge (Lesson N, or 📝 Test / 🎓 Final Test / 🔄 Review — tests visually distinct), date, title, "N words / X of Y exercises" with ✅ when complete, points earned, and a thin progress bar (blue, turns green at 100%).
  - Footer: site link + sign out.

## A3. Lesson player (`/lessons/[id]`)

Multi-view screen:

- **Lesson overview** — back-to-lesson nav; the lesson's content as an ordered list of: a **flashcard set**, **exercises**, and **content blocks** (text passages, embedded video, writing prompts). Each item is a tappable card showing completion state.
- **Flashcard study** — three modes the student can pick: **Flip** (tap card to reveal), **Self-Assess** (knew it / didn't), **Quiz** (multiple choice). Card faces show word, phonetic, meaning, example, optional image, an **audio pronunciation button**. Readability of the card face is paramount.
- **Content blocks** — reading text, a YouTube embed, or a **writing prompt** (textarea the student submits).
- **Exercise runner** — one of ~15 exercise types, each its own interaction:
  multiple-choice (incl. multi-correct "select all"), type-the-answer, group-sort (drag items into labelled buckets, items may have images), complete-the-sentence (gap fill with word bank), true/false, hangman, error-correction, rank-order, text-sequencing, unjumble, cloze-listening (audio), match-halves (drag), odd-one-out, dictation (audio). Common pattern: a progress bar, a question card, answer controls, a per-question correct/incorrect review, and a **finish/score screen** ("You scored X/Y", emoji 🌟/👍/💪, back button).
- **Points toast** — a celebratory "+N points!" overlay on completion. Prime candidate for a delightful colourful moment.
- **Test-lock screens** (for test-tagged exercises): "Test completed — score X% on DATE" with a per-question right/wrong review; or "Test attempt incomplete — contact your teacher to reset". Should feel clear and final, not punitive.

## A4. Vocabulary (`/vocabulary`) — the colourful flagship area

- **Browse view (default)** — header (back to home, "My Vocabulary", word count); a **hero CTA**: "Practice with the Vocabulary Trainer" (currently amber gradient — this is the signature-gradient surface); below it, a reference list of all the student's words grouped by lesson (word · phonetic · meaning). Playful 🦗 empty state if no words.
- **Vocabulary Trainer — dashboard** — back nav; optional error banner; **🔥 streak banner** ("N-day streak — review today to keep it alive" / "nice, keep going"); a **"words due" card** (big number + Flip Review / Quiz Review buttons, or "all caught up"); a **stage bar chart** — 5 bars New / Learning / Familiar / Known / Mastered with counts, **each bar tappable**; a collapsible **"🎯 N words need extra attention"** focus panel; action buttons (🔄 Refresh, + Add word); empty state if no words.
- **Review — Flip mode** — progress bar; a card showing stage badge, optional **image**, the word + **audio button**, phonetic; tap to flip → meaning + 🌐 translation + example; then **four grade buttons**: Again (red) / Hard (orange) / Good (green) / Easy (blue), each with a one-word hint.
- **Review — Quiz mode** — progress bar; word + audio + stage badge; "What does this word mean?"; 4 multiple-choice option buttons with correct/incorrect colour feedback; auto-advance.
- **Stage word list** (opened by tapping a chart bar) — header with coloured stage badge + count; on weak stages (New/Learning/Familiar) a "Review these N words now" button; the list of words, each with audio, meaning, 🌐 translation, and a **✎ Edit** button → inline edit form (word, phonetic, meaning, translation, example) the student can save (private to them). "Mastered" empty = 🏆 nudge.
- **Add word** — simple form (word*, meaning, phonetic, example).
- **Session done** — score + emoji, the stage distribution chart, Done button.

## A5. Cross-cutting components & states

- **AudioButton** — small circular pronunciation button (play / loading spinner / playing). Appears on flashcards and trainer cards. Accent it with Sky.
- **Progress bars** — thin rounded bars; in-progress = Sky, complete = Mint.
- **Empty states** — friendly, lightly humorous ("Crickets… 🦗" pattern), emoji-led, with a clear next action.
- **Skeleton loaders** — pulsing grey placeholders matching the content shape (already used on several screens).
- **Toasts** — points earned (celebratory), errors (red, dismissible).
- **Badges/pills** — level tags, status tags, stage labels, streak chips. These small coloured elements are where a lot of the "30% more colourful" lives — make them vivid but semantic.

## A6. Priority order for design

If producing mockups, do them in this order (highest student impact first):
1. **Home** (with VocabDueCard + lesson cards) — most-seen screen
2. **Vocabulary Trainer dashboard** — the colourful flagship; streak, stage bars, due card
3. **A lesson exercise + its finish/score screen** — the core learning loop + a celebratory moment
4. **Flip review card** (with the 4 grade buttons) — the SRS heart
5. **An empty state + the login/landing** — first impressions & tone

Everything else inherits the system (tokens + type + component patterns) defined in the main brief.
