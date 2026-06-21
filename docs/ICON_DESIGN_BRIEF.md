# EwL Custom Icon Set — Designer Brief

**For:** Claude Design (external design agent)
**From:** Claude Code (will integrate the delivered icons)
**App:** EwL "English with Laura" — a teacher + student language-learning web app (flashcards, lessons, exercises, IELTS practice, attendance, reports, content bank, AI generation).

## Purpose

The EwL app currently renders **every icon as a raw emoji or Unicode glyph** embedded directly in JSX and config maps — there is no icon library anywhere in the codebase. Emojis look inconsistent across OS/browser (Apple vs. Google vs. Windows render the same glyph very differently), don't inherit our brand color, and don't scale crisply. We want you to design **one cohesive, custom icon family** that replaces these emojis with a clean, friendly, education-focused look that matches the EwL "10B" design system, and to **deliver them in a precise format** (see Delivery) so they can be dropped into the repo and wired up programmatically with zero guesswork. This brief contains the complete icon inventory (every emoji found across the whole app, deduped), the visual spec, and the exact delivery contract.

---

## Brand & visual style

EwL "10B" design system. Please make the icon family feel native to this system — clean, friendly, modern, with an education / clarity tone (think "calm classroom," not "playful kids' app," not "enterprise cold").

**Typeface (icons sit next to this):** Rubik (rounded-geometric sans). Icons should echo Rubik's friendly, slightly rounded geometry — soft corners, even weight, no sharp spikes.

**Palette** (icons themselves must be monochrome `currentColor` — see specs — but design them to look good filled/stroked in any of these):

| Token | Hex | Role |
|---|---|---|
| sky | `#00aff0` | bright accent / active fills |
| sky-text | `#0076a8` | accessible blue text |
| brandblue | `#416ebe` | headings |
| ink-black | `#15161a` | primary text |
| ink-body | `#46464b` | body text |
| ink-muted | `#6b7280` | muted / inactive icons |
| surface | `#f6f8fb` | page / card background |
| hairline | `#ececef` | borders / dividers |

**Deliverable is a single coherent family** — one consistent stroke weight, corner radius, optical density, and metaphor language across all icons. They should read as obviously "from the same set."

---

## Icon design language — the creative direction (read this FIRST)

The mechanics below keep the set technically clean. **This section is what keeps it from looking like a stock icon pack.** Commit to it fully — a competent-but-generic set is the failure mode here.

**The concept in one line:** *Rubik, drawn as icons* — a warm, rounded-geometric outline family with the quiet confidence of good wayfinding signage and one unmistakable signature: the **EwL spark**. Friendly enough that teachers *enjoy* it, precise enough that they *trust* it. "Calm classroom" — not "kids' app," not "enterprise dashboard."

**Why this, not generic:** the app's entire personality lives in **Rubik** — geometric bones, softly rounded terminals, even weight. The icons must look like they fell out of the same typeface. That single constraint (echo Rubik) is what makes the set feel *designed for EwL* instead of dropped in from a library.

### Construction rules (the family grammar)
- **One weight — 2px** keyline on the 24px grid, full stop. (1.75px is the *only* permitted exception, for a glyph that genuinely clogs at 16px.) 2px reads warm and survives at 16px; 1px hairlines read cold and vanish — **banned**.
- **Rounded everything:** outer corners ≈3px radius, inner ≈1.5px; `round` caps and joins on every stroke. **No 90° corners, no flat caps, ever** — that's the Rubik echo.
- **Build from shared primitives:** one circle curvature (match Rubik's "o"), one rounded-card rectangle, one speaker body, one memo/page, one check motif. Reuse them so the icons read as relatives — define each shared sub-shape once and keep it identical across every icon that uses it (all "card" icons share the card; all "audio" share the speaker; all "test" share memo+check).
- **Open counters, optical balance:** generous interior space; a circular icon and a square icon must feel the same size in the box.

### The signature: the EwL spark ✨ (the one thing people remember)
Design a **4-point spark** — slightly asymmetric, one axis longer, a hair off-center — and use it as a system:
1. its own icon (`sparkles-ai`, the brand/AI mark — ~24 uses),
2. a small **attached accent** riding the same corner of every AI/generative icon (`ai-magic` wand, the "Generate with AI" doors, AI summary) — same spark, same size, same position every time, so "powered by AI" becomes a *visual rule*, not a text label,
3. optionally the shine on `celebrate` / `score-high`.

Lock its proportions and reuse it verbatim. **This replaces the AI clichés** — do **not** use a robot or a chip to mean "AI" (even where 🤖/🧠 appear today); use the spark.

### Personality calibration
Push two dials at once, on purpose: **warmth** (2px + rounded = approachable) and **credibility** (geometric + pixel-aligned = trustworthy — teachers must believe the tool). Reinterpret each emoji's *meaning*, never trace its shape: `💪` score-low → an encouraging upward arc/chevron, not a literal bicep. The empty-state / decorative few (`🦗` crickets, `😕` confused, `👋` wave, `🌸`, `🧹`) may carry a little extra character to warm up empty/celebration moments — but they stay in the same 2px rounded family.

### Do NOT (anti-generic guardrails)
- ❌ Don't ship a re-traced **Heroicons / Tabler / Feather / Material / Phosphor / Lucide** set. Draw original glyphs.
- ❌ No 1px hairlines; no mixed stroke weights across the set.
- ❌ No sharp 90° corners; no flat/butt caps.
- ❌ No gradients, no second hue, no baked-in shadows, no skeuomorphic detail.
- ❌ No AI/tech clichés (circuit traces, robots, brain-as-CPU) — the **spark** is the AI language.
- ❌ Don't slavishly copy emoji shapes; elevate the meaning.

### Deliver a STYLE TILE first (sign-off gate)
Before drawing all ~100 icons, deliver a one-page **proof sheet** of ~12 hero icons that define the family: the **spark**, the active nav set (`courses`, `students`, `lessons`, `reports`), `flashcards`, `audio-play`, `check` + `cross`, `ai-magic`, `sparkles-ai`, and one line-vs-filled pair — each shown at **16px and 24px**, on white **and** inside a `sky` pill. We sign off on the *language*, then you produce the full inventory in it. This is the single biggest quality safeguard — don't skip it.

---

## Design specifications

- **Grid:** 24×24 design grid. Keep a ~1px optical safe-area padding (live area ≈ 22×22) so icons don't touch the edges.
- **Style:** consistent **line / outline** style by default — **2px stroke** (the committed family weight, see *Icon design language*; 1.75px only as a rare exception for dense glyphs), **rounded caps and joins**. Use a **filled** treatment only where it's genuinely clearer (e.g. solid play triangle, solid streak flame, the "active/selected" nav state). Don't mix line and fill arbitrarily within one icon.
- **Color — critical:** every icon MUST be drawn using **`currentColor`** only. No hardcoded hex, no gradients, no multi-color. This lets us theme each icon at the usage site with Tailwind `text-*` classes (e.g. `text-sky`, `text-ink-muted`). One exception path: if an icon truly needs two tones, use `currentColor` + `currentColor` at reduced opacity (e.g. `opacity="0.4"`), never a second hex.
- **Crispness:** must read clearly at **16px** (the smallest common render — inline next to text, in pills, in dense lists) and up through **24–28px**. Align strokes to the pixel grid where possible; avoid hairlines thinner than 1.5px that vanish at 16px.
- **Optical balance:** balance visual weight across the set — a circular icon and a square icon at the same box should feel the same size. Keep counters (interior holes) open enough to survive at 16px.
- **Filled variants:** the **Navigation** icons need BOTH a **line** version (default/inactive) and a **filled** version (active/selected sidebar item). These are flagged in the inventory with "needs filled variant." A few status/feedback icons (streak flame, high-score star, completed-check) also benefit from a filled variant — flagged inline.

---

## Icon inventory

This is the complete merged inventory across the entire app (admin sidebar, admin-v2 builder, admin-beta content-bank + help, student lessons/exercises/IELTS/vocab). Same glyph used for different meanings = **separate rows with distinct names**. Same meaning reached by different glyphs = **noted in Notes**.

**Important — functional symbols:** the simple typographic glyphs (✓ ✗ → ← ↑ ↓ ▲ ▼ ▸ ▾ ☰ • ＋ etc.) are listed for completeness, but many are **already acceptable as plain glyphs** and don't strictly need custom art. The ones genuinely worth converting (for visual consistency and crisp rendering inside buttons/pills) are flagged **"convert"** in Notes; the rest are flagged **"glyph OK"** and you may skip them or provide minimal versions at your discretion.

### Navigation (sidebar / help nav — most need a filled active variant)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| courses | 📚 | Courses / "My Courses" nav item | **needs filled variant**; same glyph as `library` & `lesson-type` — distinct here as nav |
| students | 👥 | Students nav item; "My Students" help section | **needs filled variant** |
| lessons | 📖 | Lessons / "Lessons & exercises" nav item | **needs filled variant**; same glyph as `reading` & `grammar` |
| attendance | ✅ | Attendance nav item | **needs filled variant**; ✅ is heavily overloaded (also true/false, completed) — this is the nav meaning |
| reports | 📊 | Reports nav item & help section | **needs filled variant** |
| content-bank | 🗃️ | Content Bank nav item & help section | **needs filled variant** |
| help-faq | ❓ | Help / FAQ nav item; "Help & Docs"; registry unknown-type fallback | **needs filled variant** |
| admin-shield | 🛡️ | Admin / superadmin section nav item | **needs filled variant** |
| whats-new | ✨ | "What's new" nav item & section | shares ✨ with `sparkles-ai` (brand/AI accent) — same art OK, listed once as `sparkles-ai` below; keep this row as the nav alias |
| getting-started | 🚀 | "Getting started" help nav & section header | rocket |
| sidebar-nav | 🧭 | "Sidebar navigation" help section; also not-found page compass | compass; same as `compass-decor` |
| teacher-notes | 🗒️ | "Teacher notes" help nav & section; note-completion exercise | note pad |
| home | (inline SVG) | Student bottom-tab "Home" (already a hand-coded SVG) | **needs filled variant**; included so the set is complete for the student bottom tab bar |
| vocabulary-nav | (inline SVG) | Student bottom-tab "Vocabulary" (already a hand-coded SVG) | **needs filled variant** |

### Content types (blocks, lesson/test types, content sources)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| library | 📚 | "My Library" / "Add from Content Bank" / lesson-template pill | same glyph as `courses`/`lesson-type`; distinct usage |
| lesson-type | 📚 | Lesson content type; "Vocabulary / Flashcards" BLOCK_CONFIG icon | source of truth: `lib/lesson-editor/types.ts` BLOCK_CONFIG |
| flashcards-block | 📚 | BLOCK_CONFIG `flashcards` block icon | same glyph, block-map meaning |
| book-open | 📖 | Lesson count badge; "No lessons yet" empty state | open book |
| reading | 📖 / 📰 | Reading / Article block ("Read & Understand"); IELTS Reading | **same meaning, two glyphs** (📖 and 📰) — design ONE `reading` icon (article/newspaper) and we'll point both at it |
| grammar | 📐 | Grammar Focus block; "AI Grammar" changelog | ruler/set-square |
| video | 🎬 | Video block / "Watch & Learn"; YouTube source (also ▶️) | clapperboard; `video-youtube` (▶️) is a near-duplicate — see Functional/Actions |
| audio | 🎧 | Audio block / "Listen & Understand"; dictation & cloze-listening type | headphones |
| dialogue | 💬 | Conversation/Dialogue practice block; Telegram chat link; "chat" changelog | speech bubble |
| writing-task | ✍️ | Writing Task block; also "Build it myself" manual create; fill-blank type | writing hand; overlaps `write-by-hand` action — same art OK |
| pronunciation | 🔊 | Pronunciation practice block | speaker; overlaps `audio-play`/`listen` actions — same art OK |
| mistakes | ❌ / ❗ | "Common Mistakes" block (❌); "Error Corrections" block (❗ in BLOCK_CONFIG) | **two glyphs, related meaning** — design `mistakes` (alert/x-in-circle); we'll map both |
| folders | 🗂️ | Folders empty-state & tab icon; group-sort exercise type | card-index dividers |
| folder | 🗂 | Folder (no variation selector) — same family as `folders` | single folder; provide if distinct, else reuse `folders` |
| document | 📄 | Generic content-block fallback; "Import from Google Doc"; PDF/Word source; text-sequencing type | page/document |
| calendar | 📅 | "No lessons in this course" empty state; course schedule label | calendar |
| block-brick | 🧱 | Content block / "add block" empty-state; SaveToBank block-type | brick |
| block-generic | 📦 | Generic/unknown content block fallback; "Content Bank upgrades" changelog | box; merge with `block-brick`? keep separate (different metaphor in use) |
| target-exercise | 🎯 | Exercise content-type (ContentBank/SaveToBank); also MCQ exercise type | target; same art as `multiple-choice` exercise |
| content-bank-building | 🏦 | Content Bank header / empty-state | bank building; distinct from `content-bank` nav (card box) |
| school | 🏫 | "Share to School" / School Library tab & badge | school building |
| tip | 💡 | "Tip:" callout marker; "A topic" AI source; card-notes hint | lightbulb |
| info | ℹ️ | "Note:" callout marker in help | info circle |
| final-test | 🎓 | Final Test content/lesson type; graduation | graduation cap; same as `graduation` status |
| review-test | 🔄 | Review Test type; Transform exercise; "Flip" quick-action | refresh/cycle arrows; same art as `transform` exercise & `refresh` action |
| test-document | 📝 | Mid-Course Test type; "Tests" help section | memo; overlaps `memo-note`/`notes-quiz` — same art OK |
| brain | 🧠 | "Lemma-aware detection" changelog; vocab/memory cards | brain |
| cost | 💰 | "Cheaper TTS" changelog | money bag |
| package-upgrade | 📦 | "Content Bank upgrades" changelog | box (dupe of `block-generic`) |
| correction-mirror | 🪞 | "Live correction panel" changelog | mirror; niche, low priority |
| image | 🖼️ | Image content type / image source / diagram-label group; "better image search" | framed picture; overlaps `image-upload` action |

### Exercise types (the exercise-type icon registry — high reuse, student-facing)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| exercise-default | 📝 | Default/fallback exercise icon; complete-sentence; vocab quiz | memo/note |
| flashcards | 🃏 | Flashcards set / flip-cards mode / Start Review | playing card; distinct from `flashcards-block` (📚) — both mean flashcards, **different glyphs**, design ONE `flashcards` and map both if desired |
| multiple-choice | 🎯 | Multiple-choice exercise type | target; same art as `target-exercise` |
| match-halves | 🧩 | Match-halves exercise; IELTS matching | puzzle piece |
| true-false | ✅ | True-or-false exercise type | check; distinct row from `attendance`/`completed-check` though same glyph |
| transform | 🔄 | Transform exercise | refresh; same art as `review-test` |
| hangman | 🎮 | Hangman exercise type | game controller |
| type-answer | ⌨️ | Type-the-answer exercise | keyboard |
| group-sort | 🗂️ | Group-sort exercise | card-index dividers; same art as `folders` |
| error-correction | 🔍 / 🔎 | Error-correction exercise; IELTS search | magnifier; same art as `search` |
| rank-order | 🔢 | Rank-order exercise | input numbers / 1-2-3 |
| unjumble | 🔀 | Anagram / Unjumble exercise / shuffle | shuffle arrows |
| odd-one-out | 🚫 | Odd-one-out exercise | prohibit / no-entry; same glyph as `hidden` status |
| letters-abc | 🔤 | Unjumble word-mode hint (scrambled letters) | ABC tiles |
| speaking | 🗣️ | IELTS speaking exercise | speaking head |
| note-completion | 🗒️ | Note-completion exercise / notes block | note pad; same art as `teacher-notes` |
| ielts-matching-link | 🔗 | IELTS matching/link exercise; "Join lesson" external link | link/chain; overlaps `link` functional |
| ielts-pin | 🧷 | IELTS matching/pin exercise (registry) | safety pin; niche |
| ielts-repeat | 🔁 | IELTS repeat/cycle exercise (registry) | repeat arrows |
| chart-table | 📊 | IELTS chart/table-completion; (also Reports nav, see Navigation) | bar chart; same art as `reports` |
| true-false-checkx | ✓✗ | Combined glyph used as generated true/false exercise icon (AI prompt) | combined check+cross; we'll likely map to `true-false` |

### Feedback & states (results, correctness, celebration, warnings, empty states)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| score-high | 🌟 | High score (≥80%) on results screens | **filled variant recommended**; glowing star |
| score-medium | 👍 | Medium score (60–79%) on results | thumbs up |
| score-low | 💪 | Low score (<60%) "keep practicing" on results | flexed bicep / encouragement |
| celebrate | 🎉 | Correct answer / lesson complete / join success / WhatsNew header | party popper |
| star-shine | 🌟 | Decorative star on test-completion / celebration card (help) | same art as `score-high` |
| warning | ⚠ | Validation warning / false-positive notice / "already correct" | triangle-alert |
| empty-inbox | 📭 | "No content yet" / "No activity yet" empty state; empty vocab stage box | open mailbox, lowered flag; merge with `empty-mailbox` |
| empty-mailbox | 📭 | "No activity recorded yet" empty state | duplicate of `empty-inbox` — design ONE |
| empty-crickets | 🦗 | "Crickets…" empty state (no students/courses/vocab) | cricket; playful empty-state |
| face-confused | 😕 | Error / not-found empty-state face | confused face |
| check | ✓ | Correct-answer mark / selected / "Saved" / "Knew it!" / present | **convert** (used in pills & rows ~80+×); also draw `check-filled` for circle-badge use |
| cross | ✗ | Incorrect-answer mark / wrong placement / "Still learning" | **convert** (~58×) |

### Actions (buttons — close, edit, save, upload, play, AI, etc.)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| close-x | ✕ | Close / dismiss modal / remove chip-or-row | **convert** (~46×, appears inside round buttons) |
| sign-out | ↪ | Sign out action | **convert** |
| trash | 🗑 | Delete block / item | wastebasket |
| save-disk | 💾 | "Save to Content Bank" | floppy disk |
| edit | ✏️ / ✎ | Edit / edit-mode toggle / empty-content placeholder pencil | **two glyphs** (✏️ and ✎) → one `edit` pencil |
| write-by-hand | ✍️ | "Build it myself" manual-create door | writing hand; same art as `writing-task` |
| eye-preview | 👁 | Preview / published toggle / "Preview shuffle" / published indicator | eye |
| play | ▶ | "Preview as student" / "Preview" template / play | **convert**; solid triangle (filled) |
| video-youtube | ▶️ | YouTube/video content source option | play-in-frame; relate to `play` + `video` |
| restart | ↻ | Restart exercise | circular arrow; same art as `refresh`/`regenerate`/`reset` |
| refresh | ↻ | "Regenerate" AI summary | duplicate of `restart` — design ONE circular-arrow |
| reset | ↺ | "Reset" test for retakes (teacher) | counter-clockwise arrow; pair with `restart` |
| regenerate | ↻ | "Regenerate" AI summary (help) | duplicate of `refresh` |
| ai-magic | 🪄 | AI assist / generate / auto-correct (magic wand) | magic wand; key AI action |
| sparkles-ai | ✨ | AI accent / "Generate with AI" / brand mark / AI summary eyebrow | sparkles; brand+AI; high reuse (~24×) |
| ai-robot | 🤖 | "AI generation on every block" changelog | robot |
| upload | ⬆️ | "Choose a file" / PDF/Word upload door | up-arrow into tray |
| image-upload | 🖼️ | Upload image / screenshot door | picture-in-frame; same art as `image` |
| camera-upload | 📷 | Add/attach photo on flashcard / gap-fill / diagram | camera |
| folder-upload | 📁 | Choose/upload an audio file | open folder |
| paste | 📋 | Paste text source / "Paste a passage" / clipboard; "session report" changelog | clipboard |
| folder-move | 🗂 | "Move/Add to folder" menu action | folder-with-arrow |
| unshare-undo | ↩ | "Unshare" action | undo arrow |
| share-school | 🏫 | "Share to School" action | same art as `school` |
| audio-play | 🔊 | Play audio / speaker (dictation, listen, replay, pronunciation) | speaker; high reuse (~16×); same art as `pronunciation`/`listen` |
| audio-slow | 🐢 | Play audio slowly | turtle / slow-speaker |
| listen | 🔊 | Per-message/per-line TTS playback | duplicate of `audio-play` |
| microphone | 🎙 | "Speak to AI" voice in/out | microphone |
| clear-format | ⌫ | Clear/erase text formatting hint (RichTextEditor) | backspace key; **glyph OK** |

### Status / badges (small inline labels & counters)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| present | ✓ | "Present" attendance status | reuse `check` |
| absent | ✕ | "Absent" attendance status | reuse `close-x` / `cross` |
| late | 🕐 | "Late" attendance status | clock |
| excused | 📝 | "Excused" attendance status | reuse `exercise-default` / memo |
| completed-check | ✅ | Done exercises / studied flashcards / completed outline items | **filled variant recommended** (check-in-circle); distinct from `attendance` nav |
| hidden | 🚫 | Unpublished / hidden content-item state | no-entry; same art as `odd-one-out` |
| streak-fire | 🔥 | Student streak counter | **filled variant recommended**; flame; high reuse (~8×) |
| star-points | ⭐ | Points / score total badge | star (relate to `score-high`) |
| trophy | 🏆 | Mastered word stage (box 5) | trophy |
| user-single | 👤 | Trainer / single-person label on course card | single person |
| company-building | 🏢 | Student company label | office building |
| graduation | 🎓 | Final-test header label | same art as `final-test` |
| paused | ⏸️ | Paused / in-progress test session | pause bars |
| translation-globe | 🌐 | Translation indicator (vocab trainer) | globe |
| coming-soon | 🛠️ | Coming-soon / under-construction (IELTS editor) | tools/wrench |
| shared-check | ✓ | "Shared" pill badge on content | reuse `check` |

### Functional symbols (most may stay as glyphs — convert only the flagged ones)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| arrow-right | → | Next / forward / breadcrumb / "leads to" | **glyph OK** (also appears in code comments); convert if you want consistency in buttons |
| arrow-left | ← | Back / previous nav | **glyph OK** |
| arrow-up | ↑ | Move item up (reorder) | **glyph OK** |
| arrow-down | ↓ | Move item down (reorder) | **glyph OK** |
| arrow-double-right | ⇒ | "implies/results in" — **code comment only, NOT rendered** | exclude from set |
| caret-up | ▲ | Move block/item up; expand caret (up) | **convert** (in tight reorder buttons) |
| caret-down | ▼ | Move block/item down; collapse caret; select caret | **convert** |
| caret-right | ▸ | Folder-tree collapsed; "Finish session ▸" | **convert**; pairs with caret-down for tree |
| caret-down-small | ▾ | Folder-tree expanded toggle | reuse `caret-down` |
| caret-right-small | ▸ | Folder-tree collapsed toggle | reuse `caret-right` |
| chevron-down | ⌄ | "Show more" chevron on exercise/content cards | **convert**; thin chevron |
| menu-hamburger | ☰ | Mobile hamburger menu; also drag-reorder grip | **convert**; note dual use (menu vs. drag-grip) |
| drag-grip | ☰ | Drag-to-reorder grip handle (editors) | **convert**; consider a dots-grip distinct from hamburger |
| plus | ＋ / ➕ | "New" create action / "Add word" | **convert** (➕ and ＋ → one `plus`) |
| search | 🔍 | Search / "No matches" / "Find image" / filters-active | **convert**; magnifier; same art as `error-correction` |
| bullet | • | List bullet (note-completion runner; mostly comment docs) | **glyph OK** |
| swap-horizontal | ⇄ | Swap columns (match-halves editor) | **convert** |
| link | 🔗 | "Join lesson" link; matching link | same art as `ielts-matching-link` |
| map-pin | 📍 | Diagram-label pin marker (IELTS reading) | location pin |

### Decorative / misc (lower priority — keep playful character)

| Icon name | Current emoji | Meaning / where used | Notes |
|---|---|---|---|
| compass-decor | 🧭 | Not-found page compass; "navigation" WhatsNew | same art as `sidebar-nav` |
| wave-hello | 👋 | Welcome greeting (sign-in, Telegram hello) | waving hand |
| envelope-email | ✉️ | Email-sent confirmation (forgot-password) | envelope |
| flower | 🌸 | "Hangman got a friendlier look" changelog | flower; one-off changelog decor |
| broom | 🧹 | "Removed from the picker" changelog (cleanup) | broom; one-off |
| bullet-dot | • | Code-comment block docs (non-UI) | exclude / low priority |

> **Excluded from the set (not rendered UI):** `⇒` (code comments only), box-drawing chars `─ ═` (comment dividers), typographic ellipsis `…` (~120× in "Loading…/Saving…" — plain text, not an icon).

---

## Sizes & usage

- **Typical render sizes:** 16px (inline beside Rubik text, in dense list rows, in pills/badges), 20px (buttons, nav items at default), 24px (nav active, section headers, empty-state icons sometimes scaled up to 32–48px via the same SVG). Design at 24 and confirm legibility down to 16.
- **Inline with text:** icons sit on the text baseline next to Rubik labels. They should optically match cap-height/x-height — don't make them visually taller than the adjacent text.
- **Inside colored pills & buttons:** icons frequently appear inside filled pills (e.g. a `sky` background button, a colored status badge). Because of `currentColor`, the icon inherits the button's text color — so a white icon on a `sky` button and a `sky-text` icon on a `surface` chip use the **same SVG**. This is exactly why **`currentColor` is mandatory** and why no color may be baked in.

---

## Delivery format (CRITICAL for integration)

Deliver **individual optimized SVGs, one file per icon**, plus a manifest. Get this exactly right so integration is mechanical.

**Each SVG file must:**
- Use `viewBox="0 0 24 24"`.
- Have **no fixed pixel width/height** — either omit `width`/`height` entirely, or set `width="1em" height="1em"`.
- Use **`stroke="currentColor"` and/or `fill="currentColor"` only**. No hex colors, no `rgb()`, no gradients, no `class` color hooks.
- Be run through **SVGO** (optimized): decimals trimmed to ~2 places, paths merged where safe.
- Contain **no** `<style>` blocks, **no** `<script>`, **no** `id` attributes, **no** `<title>`/`<desc>` (or keep `<title>` only if harmless), **no** XML doctype/comments.
- Keep `stroke-linecap="round"` / `stroke-linejoin="round"` where the design uses rounded ends, and `stroke-width` consistent across the family.
- Be a single root `<svg>` — no wrapper groups that bake in transforms unnecessarily.

**Filenames = the kebab-case icon name** from the inventory, with `.svg`:
- e.g. `flashcards.svg`, `audio-play.svg`, `score-high.svg`, `content-bank.svg`.
- **Filled variants** get a `-filled` suffix: `courses-filled.svg`, `students-filled.svg`, `streak-fire-filled.svg`, `check-filled.svg`, etc.

**`manifest.json`** — a single JSON array, one object per delivered file:
```json
[
  {
    "name": "flashcards",
    "file": "flashcards.svg",
    "category": "exercise-type",
    "meaning": "Flashcards set / flip-cards mode / Start Review",
    "currentEmoji": "🃏"
  }
]
```
Include filled variants as their own entries (`"name": "courses-filled"`, `"file": "courses-filled.svg"`, same category/meaning, note variant in `meaning` or add `"variant": "filled"`).

**Bundle:** put every `.svg` plus `manifest.json` in **one flat folder named `ewl-icons/`** (no nested subfolders). Deliver that folder, or a zip named **`ewl-icons.zip`** that extracts to a folder `ewl-icons/`. Nothing else in the folder.

---

## How to hand it back to Claude Code

1. **Drop the folder into the repo:** place `ewl-icons/` at `/Users/laurasamvelyan/Developer/flashcards-app/public/ewl-icons/` (so the SVGs + `manifest.json` live under `public/`). **Or** attach `ewl-icons.zip` in chat and I'll extract it to that path.
2. I will then:
   - Build a single `<Icon name="..." className="..." />` React component that **inlines the SVG** (so `currentColor` + Tailwind `text-*` and `size` classes work), keyed off `manifest.json`.
   - Forward size via className (e.g. `className="w-4 h-4 text-sky"`) and color via `currentColor`, so existing Tailwind usage keeps working with zero style rewrites.
   - Swap each emoji usage site for `<Icon name="…" />`, including the central registries: **`lib/lesson-editor/types.ts` `BLOCK_CONFIG`** (single source of truth for block-type icons), the exercise-type registry, and the small inline icon maps in `SaveToBankModal.tsx` / `ContentBankPickerModal.tsx`.

**Acceptance criteria (I will check these before wiring up):**
- [ ] Every non-excluded `name` in this brief's inventory has a corresponding `.svg` (functional-symbol "glyph OK" rows optional but welcome).
- [ ] All flagged **filled variants** delivered with `-filled` suffix.
- [ ] Every SVG is valid, uses `viewBox="0 0 24 24"`, has no fixed px width/height, and uses **`currentColor` only** (a grep for `#`, `rgb(`, `<style`, `<script`, `gradient` across the folder must return nothing).
- [ ] `manifest.json` is valid JSON and lists **every** delivered file with `name`, `file`, `category`, `meaning`, `currentEmoji`.
- [ ] Filenames exactly match the kebab-case `name` (+ `-filled`), all lowercase, hyphen-separated.
- [ ] Folder is flat and named `ewl-icons/`.

---

## Notes for the designer

**Existing icon-library situation (from a full codebase scan):** there is **no icon library anywhere** — the scan grepped for lucide, tabler, heroicons, react-icons, @radix-ui/react-icons, phosphor, feather, font-awesome, material-icons across the whole app and found **zero matches**; `package.json` has none of them either. **100% of current iconography is raw emoji / Unicode glyph string literals** embedded directly in JSX and config objects. You are designing the **first** icon set for this app — there's no existing visual language to match besides the EwL "10B" system above, so you have a clean slate.

**Two things to know about where icons come from in code (so your naming/coverage lines up):**
1. **`lib/lesson-editor/types.ts` → `BLOCK_CONFIG`** is the **single source of truth for block-type icons** (`flashcards 📚`, `exercise 🎯`, `mistakes ❗`, `video 🎬`, `audio 🎧`, `article 📰`, `dialogue 💬`, `grammar 📖`, `writing ✏️`, `pronunciation 🔊`, `ielts_reading 📖`). It's consumed via `cfg?.icon` in `CalmLessonEditor.tsx`, `ContentItemCard.tsx`, and `calm-builder/LessonLivePreview.tsx`. The **exercise-type registry** (also in `lib/lesson-editor/types.ts` / `lib/ielts/registry.ts`) similarly drives the student-facing exercise icons. These two registries cover the bulk of the high-reuse content/exercise icons — prioritize them.
2. `SaveToBankModal.tsx` and `ContentBankPickerModal.tsx` define their own small inline icon maps — same glyphs, will be remapped to your icons.

**A few inline hand-coded SVGs already exist** (not a library): student bottom-nav Home/Vocabulary icons (`student-ui/BottomTabBar.tsx`), a loading spinner + speaker (`AudioButton.tsx`), a checkmark (`ExerciseRunner.tsx`), a chevron and speaker/volume (`app/lessons/[id]/page.tsx`), and the Hangman gallows drawing (`HangmanRunner.tsx`). Of these: **Home** and **Vocabulary** are in the inventory (please design them so the bottom tab bar matches the set, with filled active variants). The **Hangman gallows** is a bespoke illustration, not an icon — leave it; we only need the `hangman` exercise-type icon (🎮). The spinner stays as-is.

**Overload / dedupe guidance** (please design ONE icon and we'll alias in code where the same metaphor recurs):
- `🔄 / 🔁` → one cycle/refresh icon family (review-test, transform, refresh, regenerate, restart, reset can share or near-share).
- `🔊` speaker → one icon for audio-play / listen / pronunciation.
- `📭` → one empty-inbox/mailbox.
- `📖 + 📰` reading, `🃏 + 📚` flashcards, `✏️ + ✎` edit, `➕ + ＋` plus, `🎯` exercise/MCQ, `🗂️` folders/group-sort, `🔍 + 🔎` search/error-correction, `🧭` compass, `🎓` graduation/final-test, `🏫` school — these are **same-meaning-multiple-glyph** cases noted in the inventory; design one each.
- `✅` is the most overloaded glyph — it means **nav-attendance**, **true/false exercise**, and **completed-status** in different places. Please provide distinct icons (`attendance`, `true-false`, `completed-check`) so we can disambiguate; they may share a check motif but should be visually distinguishable (e.g. check-in-box vs. plain check vs. check-in-circle).

**Keep the empty-state / decorative icons (🦗 crickets, 😕 confused face, 👋 wave, 🌸 flower, 🧹 broom) a touch more characterful** than the functional set — they're meant to add warmth to empty/celebration states — while still living in the same line-weight family.
