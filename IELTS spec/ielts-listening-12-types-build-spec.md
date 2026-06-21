# IELTS Listening — 12 Question Types

**A build brief for Claude Design**

This document describes each of the 12 IELTS Listening question types in enough detail to build them two ways:

- **Static mockup** — a non-functional visual of what the exercise looks like.
- **Interactive exercise** — a working version the learner can complete, with answer-checking.

All interaction patterns mirror the **computer-delivered** IELTS test (the format used from 2026).

> The 12 types are the official 10, with **plan / map / diagram labelling** split into three separate types (3, 4, 5).

---

## Shared conventions (apply to every type)

These rules hold across all 12 types. Build them once; reuse everywhere.

**The core difference from Reading: audio replaces the passage.** There is no text to scan. The learner hears a recording and answers as they listen.

**Audio player.** A player sits at the top of the screen. Two modes:
- **Exam mode** — audio plays **once**, automatically, no pause or replay. This matches the real test.
- **Practice mode** — pause, rewind, replay, and adjustable speed allowed. Default for learning.
Build a toggle for the two modes.

**Question order follows the audio.** Answers come up in the same order they are spoken. Keep questions in that sequence.

**Reading time.** In the real test the learner gets a few seconds to read each set before it is heard. In exam mode, show a short countdown before the audio for that set begins.

**Layout.** Audio player on top (sticky). Questions below in a single scrolling column. On wide screens, a visual element (form, table, map) can sit beside its questions.

**Answer-checking.** Each exercise has a *Check* button. On check:
- Correct answers turn green.
- Wrong answers turn red, with the correct answer shown.
- A score appears (e.g. "7 / 10").

**Word limits.** Gap-fill types carry a limit like "NO MORE THAN TWO WORDS AND/OR A NUMBER." Enforce it: too many words = wrong, even if the words are right. Misspelling = wrong. Hyphenated words count as one word; contractions are not tested.

**Transcript.** In practice mode, offer a *Show transcript* button after checking — never before.

**State.** Save the learner's answers for the session so they can leave and return. (No browser storage in the preview — hold answers in memory.)

---

## The 12 types

### 1. Multiple choice

**Tests:** main idea, detail, speaker opinion.

**Structure:** a question stem with 3 options (A–C), or a variant asking the learner to pick **two** answers from a longer list (A–E).

**Learner interaction:** click one radio button per question (or check the required number of boxes in the multi-answer variant).

**Input:** single-select radio group, or multi-select with a fixed required count.

**Answer-checking:** exact match to the correct letter(s); order does not matter in the multi-answer variant.

**Instruction template:** *Choose the correct letter, A, B or C.* / *Choose TWO letters, A–E.*

**Build note:** options often use synonyms of what's heard, not the exact words — content authoring concern, not a build concern.

---

### 2. Matching

**Tests:** detail, connections between items (common in Part 1 conversations).

**Structure:** a numbered list of items, matched to a short lettered list of options. Options **can be reused or unused**.

**Learner interaction:** assign an option letter to each item via dropdown or drag-and-drop.

**Input:** dropdown of option letters per item, or a drag bank.

**Answer-checking:** exact letter match; allow reuse.

**Instruction template:** *What … does each person choose? Choose [N] answers from the box and write the correct letter, A–[last], next to each.*

---

### 3. Plan labelling

**Tests:** following directions / spatial language about a building layout or floor plan.

**Structure:** a floor plan image with several labelled points blank. The learner fills each blank from a lettered option bank or by typing.

**Learner interaction:** drag labels from a bank onto the plan, or select a letter for each numbered point.

**Input:** drag-and-drop onto plan markers, or dropdown per marker.

**Answer-checking:** each marker matched to its correct label.

**Instruction template:** *Label the plan below. Choose [N] answers from the box and write the correct letter, A–[last], next to questions …*

**Build note:** needs a plan image/SVG with numbered markers as drop-zones. Keep the plan clean and clearly numbered.

---

### 4. Map labelling

**Tests:** following directions across a map (streets, locations, compass directions).

**Structure:** a map image with numbered locations to identify, plus a lettered bank of place names (or labels positioned on the map).

**Learner interaction:** drag place names onto map points, or pick a letter per numbered location.

**Input:** drag-and-drop onto map markers, or dropdown per marker.

**Answer-checking:** each location matched to its correct label.

**Instruction template:** *Label the map below. Choose [N] answers from the box …*

**Build note:** map image/SVG with clear markers; include a compass/orientation cue if directions are spoken.

---

### 5. Diagram labelling

**Tests:** understanding a description of an object, machine, or process.

**Structure:** a diagram/illustration with callout lines pointing to parts; some labels are blank. Fill from a bank or by typing.

**Learner interaction:** type each missing label, or drag from a bank onto the callout.

**Input:** text fields anchored to callouts, or drag-and-drop bank.

**Answer-checking:** each label matched/typed correctly; enforce word limit on type-in variant.

**Instruction template:** *Label the diagram below. Write NO MORE THAN [N] WORDS for each answer.* / *…choose from the box.*

**Build note:** image/SVG with callout lines pointing to gap fields. Keep it simple and numbered.

---

### 6. Form completion

**Tests:** detail — names, numbers, dates, addresses (very common in Part 1).

**Structure:** a form (e.g. a booking or registration form) with field labels and blank values. The learner fills the blanks as they listen.

**Learner interaction:** type into each blank field.

**Input:** inline text fields inside a form layout; word-limit guard.

**Answer-checking:** accepted-answers match per field (include valid spelling variants in brackets); enforce word limit; misspelling = wrong.

**Instruction template:** *Complete the form below. Write NO MORE THAN [N] WORDS AND/OR A NUMBER for each answer.*

**Static mockup notes:** show a realistic form — label on the left, input box on the right, some fields pre-filled.

---

### 7. Note completion

**Tests:** detail within a structured set of notes.

**Structure:** condensed notes (short phrases under sub-headings, often bulleted) with gaps.

**Learner interaction:** type into each gap.

**Input:** inline text fields with word-limit guard.

**Answer-checking:** accepted-answers match; enforce word limit.

**Instruction template:** *Complete the notes below. Write NO MORE THAN [N] WORDS AND/OR A NUMBER for each answer.*

**Build note:** render as an indented note block with clear headings, not flowing prose.

---

### 8. Table completion

**Tests:** detail, comparison across categories.

**Structure:** a table (rows and columns) with some cells blank.

**Learner interaction:** type into each blank cell.

**Input:** text fields inside specific cells; filled cells read-only.

**Answer-checking:** accepted-answers match per cell; enforce word limit.

**Instruction template:** *Complete the table below. Write NO MORE THAN [N] WORDS AND/OR A NUMBER for each answer.*

**Static mockup notes:** real table; blank cells outlined as inputs, pre-filled cells in plain text.

---

### 9. Flow-chart completion

**Tests:** following a process or sequence of steps.

**Structure:** connected boxes (steps with arrows), some with gaps. Fill by typing, or from a word bank.

**Learner interaction:** type into gaps, or select/drag from a bank.

**Input:** text fields inside boxes, or dropdowns from a bank.

**Answer-checking:** accepted-answers match; enforce word limit; bank variant matches the choice.

**Instruction template:** *Complete the flow-chart below. Write NO MORE THAN [N] WORDS …* / *…choose from the box.*

**Static mockup notes:** boxes joined by arrows; gapped boxes show an input field.

---

### 10. Summary completion

**Tests:** grasp of the main ideas of a section.

**Structure:** a paragraph-length summary of part of the recording, with gaps. Two sub-variants:
- **Type-in** — type the words heard.
- **From a word list** — choose from a provided box (more words than gaps).

**Learner interaction:** type into each gap, or drag/select from the word bank.

**Input:** inline text fields, or dropdowns/drag from a bank.

**Answer-checking:** accepted-answers per gap; enforce word limit on type-in; bank variant matches the choice.

**Instruction template:** *Complete the summary below. Write NO MORE THAN [N] WORDS …* / *…choose from the box.*

---

### 11. Sentence completion

**Tests:** detail, relationships between ideas.

**Structure:** sentences with a gap, completed with words from the recording, within a word limit.

**Learner interaction:** type into the gap (inline field inside the sentence).

**Input:** free-text field with word-limit guard.

**Answer-checking:** accepted-answers match (include valid variants in brackets); enforce word limit; misspelling = wrong.

**Instruction template:** *Complete the sentences below. Write NO MORE THAN [N] WORDS AND/OR A NUMBER for each answer.*

---

### 12. Short-answer questions

**Tests:** concrete facts — places, prices, times.

**Structure:** open questions answered in a few words from the recording. Some ask for a list of two or three points.

**Learner interaction:** type a short answer per question.

**Input:** single-line text field(s) with word-limit guard.

**Answer-checking:** accepted-answers match; only the key noun/number needed; enforce word limit; misspelling = wrong.

**Instruction template:** *Answer the questions below. Write NO MORE THAN [N] WORDS AND/OR A NUMBER for each answer.*

---

## Reusable component summary

Most types reduce to a small set of components — build these first.

| Component | Used by types |
|---|---|
| Audio player (exam / practice modes) | all |
| Single/multi radio select | 1 |
| Letter dropdown / option bank | 2, 3, 4, 5 (variants) |
| Drag-and-drop bank | 3, 4, 5, 9, 10 (variants) |
| Image with markers/callouts | 3, 4, 5 |
| Inline gap text field (+ word limit) | 5, 6, 7, 8, 9, 10, 11, 12 |
| Word-bank selector | 9, 10 (variants) |
| Container layouts (form / notes / table / flow-chart) | 6, 7, 8, 9 |

Build the shared conventions (audio player, word-limit guard, check/score logic) and these components first; each question type is then a thin layer on top.

---

## How this maps to the Reading spec

Listening reuses most Reading components. The differences:

- **Audio player** replaces the reading passage, and adds the once-only **exam mode**.
- **Plan / map / diagram labelling** (types 3–5) are Listening-specific and need image assets with markers.
- **Form completion** (type 6) is Listening-specific.
- No True/False/Not Given or Yes/No/Not Given types in Listening.
- Questions follow audio order, so sequencing is fixed, not free.
