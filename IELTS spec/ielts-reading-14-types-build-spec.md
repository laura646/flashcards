# IELTS Reading — 14 Question Types

**A build brief for Claude Design**

This document describes each of the 14 IELTS Reading question types in enough detail to build them two ways:

- **Static mockup** — a non-functional visual of what the exercise looks like.
- **Interactive exercise** — a working version the learner can complete, with answer-checking.

All interaction patterns mirror the **computer-delivered** IELTS test (the format used from 2026), so learners practise the real thing.

---

## Shared conventions (apply to every type)

These rules hold across all 14 types. Build them once; reuse everywhere.

**Layout.** Split screen. Reading passage on the left, questions on the right. Both panels scroll independently. On narrow screens, stack the passage above the questions with a toggle to switch focus.

**Passage panel.** Plain text with paragraph labels (A, B, C…) shown in the margin when the question set needs them. Learner can highlight text (computer-delivered IELTS allows highlighting and note-taking).

**Question panel.** Each set opens with an **instruction line** (the grey rule text, e.g. "Choose the correct letter"). Then the numbered questions.

**Answer-checking.** Each exercise has a *Check* button. On check:
- Correct answers turn green.
- Wrong answers turn red, with the correct answer shown.
- A score appears (e.g. "4 / 6").
Spelling and word-count rules matter for gap-fill types — see each type below.

**Word limits.** Gap-fill types carry a limit like "NO MORE THAN TWO WORDS." Enforce it: if the learner exceeds it, mark wrong even if the words are right.

**State.** Save the learner's answers so they can leave and return. (No browser storage in the preview — hold answers in memory for the session.)

---

## The 14 types

### 1. Multiple choice

**Tests:** detail, main idea, or writer's purpose.

**Structure:** a question stem followed by 3–4 options (A–D). Some variants ask the learner to pick **two** answers from five options (A–E).

**Learner interaction:** click one radio button per question (or check two boxes in the two-answer variant).

**Input:** single-select radio group, or multi-select with a fixed required count.

**Answer-checking:** exact match to the correct letter(s). In the two-answer variant, both must be right; order does not matter.

**Instruction template:** *Choose the correct letter, A, B, C or D.* / *Choose TWO letters, A–E.*

**Static mockup notes:** show the stem, options as a vertical list with empty radio circles, one option pre-highlighted to show selected state.

---

### 2. Identifying information (True / False / Not Given)

**Tests:** whether a statement agrees with facts in the passage.

**Structure:** a list of statements. Each gets one of three labels: **TRUE**, **FALSE**, **NOT GIVEN**.

**Learner interaction:** pick one label per statement from a dropdown (computer-delivered style) or three buttons.

**Input:** dropdown or button group, three fixed values.

**Answer-checking:** exact match to TRUE / FALSE / NOT GIVEN.

**Instruction template:** *Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.*

**Key build note:** keep TRUE/FALSE (facts) distinct from the YES/NO type below (opinions). Do not mix them in one set.

---

### 3. Identifying writer's views / claims (Yes / No / Not Given)

**Tests:** whether a statement matches the writer's **opinion or claim** (not facts).

**Structure:** identical to type 2, but labels are **YES**, **NO**, **NOT GIVEN**.

**Learner interaction, input, checking:** same mechanics as type 2, with the YES/NO/NOT GIVEN value set.

**Instruction template:** *Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.*

---

### 4. Matching information

**Tests:** locating a specific detail (example, reason, definition) inside a paragraph.

**Structure:** a list of statements; the learner names the paragraph (A, B, C…) that contains each one. Paragraphs **can be reused**; some are never used.

**Learner interaction:** type or select the paragraph letter for each statement.

**Input:** dropdown of paragraph letters, or a short text field.

**Answer-checking:** exact letter match. Allow reuse.

**Instruction template:** *Which paragraph contains the following information? Write the correct letter, A–[last].*

**Build note:** passage paragraphs MUST show their letter labels in the margin.

---

### 5. Matching headings

**Tests:** identifying the main idea of each paragraph.

**Structure:** a numbered list of paragraphs to match, and a separate lettered (or roman-numeral) list of headings. There are **more headings than paragraphs** — some headings are distractors and stay unused. Each heading used once.

**Learner interaction:** drag a heading onto each paragraph, or pick from a dropdown per paragraph.

**Input:** drag-and-drop bank, or dropdown of heading numerals.

**Answer-checking:** each paragraph matched to its correct heading; one-to-one.

**Instruction template:** *Choose the correct heading for each paragraph from the list of headings below.*

**Static mockup notes:** show two columns — a heading bank (with leftover headings) on one side, paragraph drop-zones on the other.

---

### 6. Matching features

**Tests:** linking items to a category (e.g. statements to researchers, dates, or places).

**Structure:** a list of statements, and a short lettered list of "features" (people/things). Features **can be reused or unused**.

**Learner interaction:** assign a feature letter to each statement.

**Input:** dropdown of feature letters per statement.

**Answer-checking:** exact letter match; allow reuse.

**Instruction template:** *Match each statement with the correct person, A–[last]. You may use any letter more than once.*

---

### 7. Matching sentence endings

**Tests:** understanding relationships between ideas.

**Structure:** sentence beginnings (numbered) and a longer list of possible endings (lettered). More endings than beginnings; each ending used once.

**Learner interaction:** attach an ending to each beginning via dropdown or drag-and-drop.

**Input:** dropdown of ending letters, or drag bank.

**Answer-checking:** one-to-one match; distractor endings stay unused.

**Instruction template:** *Complete each sentence with the correct ending, A–[last].*

---

### 8. Sentence completion

**Tests:** detail, paraphrase recognition.

**Structure:** sentences with a gap. The learner fills the gap with **words taken directly from the passage**, within a word limit.

**Learner interaction:** type into the gap (inline text input inside the sentence).

**Input:** free-text field with a character/word guard.

**Answer-checking:** match against an accepted-answers list (include valid spelling/word-order variants in brackets, as official answer keys do). Enforce the word limit. Mark wrong on misspelling.

**Instruction template:** *Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage.*

---

### 9. Summary completion

**Tests:** grasp of the main ideas of a section or whole passage.

**Structure:** a paragraph-length summary of part of the text, with several gaps. Two sub-variants:
- **From the passage** — type words taken from the text.
- **From a word list** — choose from a provided box of words (more words than gaps).

**Learner interaction:** type into each gap, OR drag/select from the word bank.

**Input:** inline text fields, or dropdowns/drag from a word bank.

**Answer-checking:** accepted-answers match per gap; enforce word limit on the type-in variant; word-bank variant matches the chosen letter/word.

**Instruction template:** *Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage.* / *…using the list of words, A–[last].*

---

### 10. Note completion

**Tests:** detail within a section.

**Structure:** condensed notes (short phrases, bullet style, often under sub-headings) with gaps. Like summary completion but in note form rather than full prose.

**Learner interaction:** type into each gap.

**Input:** inline text fields with word-limit guard.

**Answer-checking:** accepted-answers match; enforce word limit.

**Instruction template:** *Complete the notes below. Choose NO MORE THAN [N] WORDS from the passage.*

**Build note:** render as an indented note block with clear headings, not flowing paragraphs.

---

### 11. Table completion

**Tests:** detail, comparison across categories.

**Structure:** a table (rows and columns) with some cells empty. The learner fills the empty cells from the passage.

**Learner interaction:** type into each empty cell.

**Input:** text fields inside specific table cells; filled cells are read-only.

**Answer-checking:** accepted-answers match per cell; enforce word limit.

**Instruction template:** *Complete the table below. Choose NO MORE THAN [N] WORDS from the passage.*

**Static mockup notes:** show a real table; empty cells outlined as input boxes, pre-filled cells in plain text.

---

### 12. Flow-chart completion

**Tests:** understanding a process or sequence.

**Structure:** a series of connected boxes (steps with arrows), some containing gaps. Fill from the passage, or from a word list.

**Learner interaction:** type into gaps, or select/drag from a word bank.

**Input:** text fields inside flow-chart boxes, or dropdowns from a bank.

**Answer-checking:** accepted-answers match; enforce word limit; word-bank variant matches the choice.

**Instruction template:** *Complete the flow-chart below. Choose NO MORE THAN [N] WORDS from the passage.*

**Static mockup notes:** vertical or horizontal boxes joined by arrows; gapped boxes show an input field.

---

### 13. Diagram label completion

**Tests:** understanding a description of an object, place, or mechanism.

**Structure:** a labelled diagram/illustration with some labels missing. The learner fills the missing labels from the passage.

**Learner interaction:** type each missing label into the field beside its pointer line.

**Input:** text fields anchored to diagram callouts; word-limit guard.

**Answer-checking:** accepted-answers match per label; enforce word limit.

**Instruction template:** *Label the diagram below. Choose NO MORE THAN [N] WORDS from the passage.*

**Build note:** needs an image/SVG with callout lines pointing to gap fields. Keep the diagram simple and clearly numbered.

---

### 14. Short-answer questions

**Tests:** locating specific factual detail.

**Structure:** open questions (who/what/where/how many) answered in a few words from the passage.

**Learner interaction:** type a short answer per question.

**Input:** single-line text field with word-limit guard.

**Answer-checking:** accepted-answers match; only the key noun/number is needed; enforce word limit; mark wrong on misspelling.

**Instruction template:** *Answer the questions below. Choose NO MORE THAN [N] WORDS AND/OR A NUMBER from the passage.*

---

## Reusable component summary

For efficient building, most types reduce to a small set of components:

| Component | Used by types |
|---|---|
| Single/multi radio select | 1 |
| Three-value dropdown (T/F/NG, Y/N/NG) | 2, 3 |
| Letter dropdown (paragraph/feature/ending) | 4, 5, 6, 7 |
| Drag-and-drop bank | 5, 7, 9, 12 (variants) |
| Inline gap text field (+ word limit) | 8, 9, 10, 11, 12, 13, 14 |
| Word-bank selector | 9, 12 (variants) |
| Container layouts (notes / table / flow-chart / diagram) | 10, 11, 12, 13 |

Build the shared conventions and these components first; each question type is then a thin layer on top.
