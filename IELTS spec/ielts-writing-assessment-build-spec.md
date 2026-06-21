# IELTS Writing — Assessment Research & App Build Spec

**For building an app that analyses an IELTS Writing response, estimates a band, and gives improvement advice.**

Everything here is grounded in the official IELTS sources (ielts.org), chiefly the **Writing Band Descriptors (updated May 2023)** and the **Writing Key Assessment Criteria**. Where a detail is the accepted industry approximation rather than an official published rule, it is flagged.

> **IP note.** The official band descriptors are copyrighted by the IELTS Partners. This document **restates** them as structured, analysable signals in our own words. Always validate your grading engine against the source PDFs (links in Sources).

---

## 1. Test format at a glance

The Writing test is **60 minutes**, two tasks, done in one sitting. The candidate manages their own time.

| | Academic Task 1 | General Training Task 1 | Task 2 (both modules) |
|---|---|---|---|
| What it is | Describe visual data (graph/chart/table/map/process) | Write a letter for a given situation | Essay responding to a prompt |
| Min words | 150 | 150 | 250 |
| Suggested time | ~20 min | ~20 min | ~40 min |
| Weight in section | 1 part | 1 part | 2 parts (double) |
| Output style | Report, neutral/academic tone | Letter, tone varies by reader | Argument/discussion |
| Personal opinion? | No — describe data only | Only as the situation requires | Yes — a position is required |

Key official facts the app should treat as ground truth:

- Task 2 **contributes twice as much** as Task 1 to the Writing band.
- Responses **must be connected prose** — notes or bullet points are penalised.
- **Under-length** (fewer than 150 / 250 words) is penalised under Task Achievement / Task Response.
- **Off-topic**, **memorised**, and **plagiarised** responses are penalised, sometimes severely.
- The task minimums are the same for Academic and General Training.

---

## 2. The scoring model

### 2.1 Four criteria per task

Each task is scored on four equally-weighted criteria:

| Criterion | Task 1 | Task 2 | Abbrev. |
|---|---|---|---|
| Task Achievement | ✓ | — | TA |
| Task Response | — | ✓ | TR |
| Coherence & Cohesion | ✓ | ✓ | CC |
| Lexical Resource | ✓ | ✓ | LR |
| Grammatical Range & Accuracy | ✓ | ✓ | GRA |

Note: TA (Task 1) and TR (Task 2) are different criteria with different descriptors. CC, LR and GRA share almost identical wording across both tasks (with minor paragraphing differences in CC — see §5).

### 2.2 Per-task band

The official rule: the four criteria are **weighted equally**, and the task band is their **average**.

```
TaskBand = round_half( mean(criterion_1, criterion_2, criterion_3, criterion_4) )
```

**Critical nuance for accuracy.** Examiners do not compute a clean arithmetic mean from sub-scores. Each criterion is awarded holistically using a rule:

> A script must **fully fit the positive features** of a band to earn it. **Bolded negative features** in the descriptor act as **caps** — one prominent negative feature can hold a criterion down regardless of strengths elsewhere.

So your engine should model each criterion as: *find the highest band whose positive features are all satisfied, then lower it if a capping negative feature is present.* Treat the arithmetic mean as the final combine step, not as the way each criterion is found.

### 2.3 Combining Task 1 + Task 2 into the Writing band

IELTS does **not publish** the exact algorithm. The accepted approximation, consistent with the official "Task 2 counts twice" statement:

```
WritingBand ≈ round_half( (Task1Band + 2 × Task2Band) / 3 )
```

Label this in the UI as an **estimate**, not an official calculation.

### 2.4 Overall band & rounding (official)

The overall test band is the mean of the four section bands (Listening, Reading, Writing, Speaking), rounded to the nearest half band, with two specific rules:

- Average ending in **.25 → rounds UP** to the next half band (6.25 → 6.5).
- Average ending in **.75 → rounds UP** to the next whole band (6.75 → 7.0).
- Otherwise round to the nearest half/whole band.

```
round_half(x):
  frac = x - floor(x)
  if frac < 0.25:  return floor(x)
  if frac < 0.75:  return floor(x) + 0.5
  return floor(x) + 1.0
```

There is no 9.5; the scale tops at 9.0.

### 2.5 Hard rules & penalties (encode as overrides)

These bypass normal scoring. Check them first.

| Condition | Effect |
|---|---|
| Response ≤ 20 words | Band 1 on every criterion |
| Did not attempt / wrong language throughout / wholly memorised | Band 0 |
| Under min words (≥21 but <150/<250) | Penalise TA/TR; content is usually under-developed too |
| Not connected prose (notes/bullets) | Penalised across criteria; flag explicitly |
| Off-topic / copied rubric | Copied rubric is discounted from word count; off-topic content scores very low on TA/TR |
| Plagiarised | Severe penalty |

---

## 3. The four criteria — what each measures

From the official Key Assessment Criteria. Use these as the *definition layer* your signals map back to.

### Task Achievement (TA) — Task 1 only
How fully, appropriately, accurately and relevantly the response meets the task in ≥150 words.

- **Academic:** an information-transfer task tied strictly to the data shown — select key features, give enough detail, report figures/trends accurately, compare/contrast the main differences (not mechanical detail-listing), and present an overview. No speculation beyond the data.
- **General Training:** clearly state the letter's purpose, fully cover the **three bullet points**, extend each appropriately, use a correct letter format, and keep a **consistent, appropriate tone**.

### Task Response (TR) — Task 2 only
The candidate must form and develop a **position** on the prompt in ≥250 words, supported by evidence/examples. TR assesses: how fully they answer, how well main ideas are extended and supported, how relevant the ideas are, how clearly they open the discussion / state a position / reach a conclusion, and whether the format suits the task.

### Coherence & Cohesion (CC) — both tasks
Overall organisation and logical flow: how information, ideas and language are organised and linked. **Coherence** = logical sequencing of ideas; **cohesion** = varied, appropriate cohesive devices (connectors, conjunctions, pronouns). Assesses logical organisation, paragraphing, sequencing within/across paragraphs, flexible reference/substitution, and appropriate discourse markers.

### Lexical Resource (LR) — both tasks
Range, accuracy and appropriacy of vocabulary for the task. Assesses range of general words (synonyms to avoid repetition), topic-specific/attitude vocabulary, precision of word choice, control of collocation/idiom/sophisticated phrasing, and the **density and impact of spelling and word-formation errors**.

### Grammatical Range & Accuracy (GRA) — both tasks
Range and accuracy of grammar at sentence level. Assesses range/appropriacy of structures (simple, compound, complex), the accuracy of each, the **density and impact of grammatical errors**, and accurate, appropriate **punctuation**.

---

## 4. Band descriptors as analysable signals

This is the grading core. For each band, the descriptor is restated as detectable signals. **CC, LR and GRA are shared across Task 1 and Task 2** and given once (§4.1). Then the task-specific criteria — TA for Task 1 (§4.2) and TR for Task 2 (§4.3) — are given separately.

Read each band as: *the response sits at the highest band where the positive signals hold and the capping signals are absent.*

### 4.1 Shared criteria — CC, LR, GRA (apply to both tasks)

#### Coherence & Cohesion (CC)

**Band 9** — Message follows effortlessly; cohesion so smooth it rarely draws attention; lapses minimal; paragraphing skilfully managed.
**Band 8** — Easy to follow; ideas logically sequenced; cohesion well managed with only occasional lapses; paragraphing sufficient and appropriate.
**Band 7** — Ideas logically organised with clear progression (a few minor lapses ok); a range of cohesive devices including reference/substitution used flexibly, but with some inaccuracy or over/under-use. *(Task 2 adds: paragraphing generally effective; sequencing within paragraphs generally logical.)*
**Band 6** — Generally coherent with clear overall progression; cohesive devices used to some good effect, but cohesion within/between sentences may be **faulty or mechanical** (misuse, overuse, omission); reference/substitution may lack flexibility, causing repetition or error. *(Task 2 adds: paragraphing may not always be logical / central topic may be unclear.)*
**Band 5** — Organisation evident but **not wholly logical**; may lack overall progression though underlying coherence exists; sentences not fluently linked; cohesive devices limited or overused with inaccuracy; repetition from weak reference/substitution. *(Task 2: paragraphing may be inadequate or missing.)*
**Band 4** — Ideas evident but **not arranged coherently**; no clear progression; relationships unclear/inadequately marked; only basic cohesive devices, often inaccurate/repetitive; faulty substitution/referencing. *(Task 2: may be no paragraphing / no clear topic per paragraph.)*
**Band 3** — No apparent logical organisation; ideas hard to relate; minimal sequencers/devices that don't signal real relationships; referencing hard to identify.
**Band 2** — Little evidence of organisational control.
**Band 1** — ≤20 words; fails to communicate; appears to be a non-writer.

**Detectable signals (proxies):** paragraph count and balance; presence/variety of connectors and discourse markers; over-use ratio (same connector repeated); pronoun/reference resolution; logical ordering (e.g., Task 1 overview placement; Task 2 intro→body→conclusion); sentence-to-sentence topical continuity.

#### Lexical Resource (LR)

**Band 9** — Wide range used accurately and appropriately; very natural, sophisticated control; spelling/word-formation errors extremely rare, minimal impact.
**Band 8** — Wide resource, fluent and flexible, precise meanings; skilful use of uncommon/idiomatic items despite occasional inaccuracy in choice/collocation; occasional spelling/word-formation errors, minimal impact.
**Band 7** — Resource sufficient for some flexibility and precision; some ability with less common/idiomatic items; awareness of style and collocation, though inappropriacies occur; only a few spelling/word-formation errors, not detracting from clarity.
**Band 6** — Resource generally adequate and appropriate; meaning generally clear despite **restricted range or imprecise word choice**; risk-takers show wider range but with more inaccuracy; some spelling/word-formation errors, but communication not impeded.
**Band 5** — Resource limited but **minimally adequate**; simple vocabulary may be accurate but range too narrow for variation; frequent lapses in word-choice appropriacy; inflexibility shown by simplifications/repetition; noticeable spelling/word-formation errors that may cause reader difficulty.
**Band 4** — Resource limited/inadequate or unrelated to task; basic, repetitive vocabulary; possible inappropriate **memorised chunks/lifted input language**; word-choice/word-formation/spelling errors may **impede meaning**.
**Band 3** — Very limited control of word choice/spelling; errors predominate and may severely impede meaning; over-dependence on input/memorised language.
**Band 2** — Extremely limited; few recognisable strings beyond memorised phrases; no apparent control of word formation/spelling.
**Band 1** — ≤20 words; no resource beyond a few isolated words.

**Detectable signals:** type–token ratio / vocabulary diversity; frequency band of words used (common vs less-common); repetition counts; collocation-error detection; spelling-error density; word-formation errors (e.g., *develop/development* misuse); detection of lifted prompt phrases / memorised templates.

#### Grammatical Range & Accuracy (GRA)

**Band 9** — Wide range of structures with full flexibility and control; punctuation and grammar appropriate throughout; minor errors extremely rare, minimal impact.
**Band 8** — Wide range used flexibly and accurately; majority of sentences error-free; punctuation well managed; occasional non-systematic errors, minimal impact.
**Band 7** — Variety of complex structures with some flexibility and accuracy; grammar and punctuation generally well controlled; error-free sentences frequent; a few persistent errors that don't impede communication.
**Band 6** — Mix of simple and complex forms but **limited flexibility**; complex structures less accurate than simple ones; grammar/punctuation errors occur but rarely impede communication.
**Band 5** — Range limited and **repetitive**; complex sentences attempted but often faulty; greatest accuracy on simple sentences; errors may be frequent and cause reader difficulty; punctuation may be faulty.
**Band 4** — **Very limited range**; subordinate clauses rare; simple sentences predominate; some accurate structures but frequent errors that may impede meaning; punctuation often faulty.
**Band 3** — Sentence forms attempted but grammar/punctuation errors predominate (except in memorised phrases), blocking most meaning; length may be too short to show control.
**Band 2** — Little or no evidence of sentence forms beyond memorised phrases.
**Band 1** — ≤20 words; no rateable language.

**Detectable signals:** distribution of sentence types (simple/compound/complex); subordinate-clause frequency; clause-per-sentence ratio; error density (grammar errors per 100 words); error gravity (impedes meaning vs minor); punctuation-error rate; ratio of error-free sentences.

### 4.2 Task 1 — Task Achievement (TA)

Covers both Academic and General Training; module-specific lines marked **(AC)** / **(GT)**.

**Band 9** — All task requirements fully and appropriately satisfied; extremely rare content lapses.
**Band 8** — Covers all requirements appropriately, relevantly, sufficiently. **(AC)** Key features skilfully selected, clearly presented, highlighted, illustrated. **(GT)** All bullet points clearly presented and appropriately illustrated/extended. Occasional omissions/lapses possible.
**Band 7** — Covers the requirements; content relevant and accurate (a few omissions/lapses); appropriate format. **(AC)** Selected key features covered and clearly highlighted but could be more fully illustrated/extended; clear **overview** present; data appropriately categorised; main trends/differences identified. **(GT)** All bullet points covered and clearly highlighted; clear purpose; consistent, appropriate tone; lapses minimal.
**Band 6** — Focuses on the requirements; appropriate format. **(AC)** Key features covered and adequately highlighted; a relevant **overview attempted**; info supported using figures/data. **(GT)** All bullet points covered and adequately highlighted; purpose generally clear; minor tone inconsistencies. Some irrelevant/inaccurate detail may appear; some detail missing or excessive; more extension/illustration may be needed.
**Band 5** — Generally addresses the task; format may be inappropriate in places. **(AC)** Selected key features not adequately covered; detail mainly mechanical; may be **no data** to support description. **(GT)** All bullet points present but ≥1 inadequately covered; purpose sometimes unclear; tone variable/sometimes inappropriate. Tendency to focus on detail without the big picture; irrelevant/inaccurate material in key areas; limited extension.
**Band 4** — An attempt to address the task. **(AC)** Few key features selected. **(GT)** Not all bullet points presented; purpose unclear/confused; tone may be inappropriate. Format may be inappropriate; presented features may be irrelevant/repetitive/inaccurate.
**Band 3** — Does not address the requirements (possibly misunderstanding the input); presented features largely irrelevant; limited, repetitive information.
**Band 2** — Content barely relates to the task; little relevant message or wholly off-topic.
**Band 1** — ≤20 words; wholly unrelated; copied rubric discounted.

**Detectable signals:** word count vs 150; **(AC)** presence of an overview sentence; presence of specific figures/units; coverage of the chart's main features; trend/comparison language; absence of speculation/causation. **(GT)** detection of all three bullet topics; salutation/sign-off; tone classification vs required register.

### 4.3 Task 2 — Task Response (TR)

**Band 9** — Prompt addressed and explored in depth; clear, fully developed position directly answering the question; ideas relevant, fully extended, well supported; lapses extremely rare.
**Band 8** — Prompt appropriately and sufficiently addressed; clear, well-developed position; ideas relevant, well extended and supported; occasional omissions/lapses.
**Band 7** — Main parts of the prompt appropriately addressed; clear, developed position; main ideas extended and supported, but may **over-generalise** or lack focus/precision in support.
**Band 6** — Main parts addressed (some more fully than others); appropriate format; a position directly relevant to the prompt, though conclusions may be **unclear, unjustified or repetitive**; main ideas relevant but some under-developed or unclear; some support less relevant/inadequate.
**Band 5** — Main parts **incompletely** addressed; format may be inappropriate in places; a position expressed but development not always clear; main ideas limited, under-developed, and/or with irrelevant detail; some repetition.
**Band 4** — Prompt tackled minimally or answer is tangential (possible misunderstanding); position discernible only with effort; main ideas hard to identify and may lack relevance/clarity/support; large parts repetitive.
**Band 3** — No part of the prompt adequately addressed, or prompt misunderstood; no identifiable position / little direct response; few ideas, often irrelevant or undeveloped.
**Band 2** — Content barely related to the prompt; no identifiable position; glimpses of one or two undeveloped ideas.
**Band 1** — ≤20 words; wholly unrelated; copied rubric discounted.

**Detectable signals:** word count vs 250; presence/clarity of a thesis/position; whether **all parts** of the prompt are answered (depends on essay type — §5.3); idea development depth (claim → explanation → example); presence of a conclusion that matches the stated position; on-topic relevance; repetition ratio.

---

## 5. Task-type classification (the app must detect type before scoring)

Scoring depends on *what the task asked*. Detect the module and task type, then apply the right "answered the question" test.

### 5.1 Academic Task 1 — visual types

| Visual | Core language the response should show |
|---|---|
| Line graph | Trend/change-over-time verbs (rise, fall, fluctuate, peak); time references |
| Bar chart | Comparison/superlative language across categories |
| Pie chart | Proportion/percentage language (a quarter, the majority) |
| Table | Comparison across rows/columns; selective reporting (not every cell) |
| Map | Location/direction and change language (was replaced by, relocated to) |
| Process diagram | Sequence/passive language (first, then, is heated, is collected) |
| Multiple/combined | Linking the two visuals; relating data sets |

App test for TA: did the response (a) give an **overview**, (b) report **accurate figures**, (c) **compare/contrast** the main features, and (d) **avoid speculation** about causes?

### 5.2 General Training Task 1 — letter register

| Register | Trigger | Tone signals |
|---|---|---|
| Formal | Writing to a stranger / official (e.g., a manager you don't know) | No contractions; full salutation (Dear Sir/Madam); formal sign-off |
| Semi-formal | Known person in a formal relationship | Some politeness conventions; named salutation |
| Informal | Friend/family | Contractions, casual phrasing, first-name salutation |

App test for TA: are **all three bullet points** covered and extended, is the **purpose** clear, is the **tone consistent** with the implied reader, and is letter **format** (salutation + sign-off) correct?

### 5.3 Task 2 — five essay types

Detecting the type defines what "fully answering" means — the single biggest TR factor.

| Type | Prompt cue | "Fully answered" requires |
|---|---|---|
| Opinion (agree/disagree) | "To what extent do you agree or disagree?" | A clear single position held throughout; reasons + support; (brief acknowledgement of the other side is fine) |
| Discussion (both views) | "Discuss both views and give your own opinion." | **Both** views developed **and** a stated personal opinion — missing either caps TR |
| Advantages / disadvantages | "What are the advantages and disadvantages?" / "Do advantages outweigh…?" | Both sides covered; if "outweigh" is asked, a clear verdict on which is stronger |
| Causes / problem–solution | "What are the causes and what solutions…?" | Causes/problems **and** solutions, **linked** to each other; depth over breadth |
| Two-part (direct questions) | Two distinct questions after a statement | **Both** questions answered fully |

Common type-related failures to flag: sitting on the fence when a position is required; turning a discussion essay into a one-sided opinion (or vice-versa); listing many causes/solutions without developing or linking them; answering only one half of a two-part question.

---

## 6. Turning descriptors into an analysis engine

A practical pipeline for the app.

**Step 0 — Guardrails.** Word count; connected-prose check (reject bullet/note form); language check; obvious-memorisation/lift check; copied-rubric removal. Apply the §2.5 overrides where triggered.

**Step 1 — Classify.** Module (AC/GT), task number, and task type (§5). Store the "answered the question" checklist for that type.

**Step 2 — Extract signals per criterion.** Compute the proxies listed under each criterion in §4. Examples:
- LR: vocabulary diversity, rare-word ratio, repetition, spelling-error density, collocation errors.
- GRA: sentence-type mix, subordinate-clause rate, grammar-error density and gravity, punctuation errors, error-free-sentence ratio.
- CC: paragraph structure, connector variety and over-use, reference resolution, logical ordering (overview/thesis placement).
- TA/TR: coverage of required elements, overview/thesis presence, development depth, relevance, conclusion match.

**Step 3 — Band each criterion by rubric matching.** For each criterion, walk bands top-down: assign the **highest band whose positive signals are met**, then apply **capping** if a prominent negative signal is present (e.g., "complex sentences attempted but often faulty" caps GRA near 5). Do **not** just threshold a single metric — combine signals to mirror the holistic descriptor.

**Step 4 — Combine.** Task band = mean of four criteria, rounded half (§2.2). Writing estimate = (T1 + 2·T2)/3, rounded half (§2.3).

**Step 5 — Confidence & honesty.** Present a band **range** (e.g., 6.0–6.5), not a false-precision single number. State that automated scoring approximates examiner judgement and is unreliable at the margins, especially for TR/TA depth, which need human reading.

**Calibration cautions:**
- Metrics reward surface features; examiners reward communicative effect. Long words and many connectors do **not** equal a high band — mis/over-use is explicitly penalised.
- Error **gravity** matters more than error **count** (does it impede meaning?).
- Memorised, templated, or off-topic essays can be fluent yet score low — detect them.
- Validate against a corpus of officially-scored sample answers before trusting outputs.

---

## 7. Advice generation

Map each weak criterion to concrete levers, ideally with the band-jump in mind (most learners target 6→7 and 7→8).

**Task Achievement (T1)**
- 6→7 (AC): add a clear overview sentence; report exact figures; compare the main features instead of listing every data point; cut speculation about causes.
- 6→7 (GT): cover and extend **all three** bullets; make the purpose explicit; keep tone consistent with the reader.

**Task Response (T2)**
- 6→7: state a clear position in the intro and hold it; develop each main idea with explanation **and** a specific example; make the conclusion follow the position; ensure **every part** of the prompt is answered (check essay type).
- 7→8: tighten focus and precision of support; avoid over-generalising; deepen rather than widen ideas.

**Coherence & Cohesion**
- 6→7: vary cohesive devices and stop over-using a few; fix mechanical/faulty links; one clear idea per paragraph with a topic sentence; sequence ideas logically.
- 7→8: make transitions feel natural, not signposted; sharpen reference/substitution.

**Lexical Resource**
- 6→7: widen range with accurate synonyms; use some less-common and topic-specific items; fix collocations; reduce repetition and spelling slips.
- 7→8: precise word choice; natural idiomatic/uncommon items used appropriately, not forced.

**Grammatical Range & Accuracy**
- 6→7: use a variety of complex structures **accurately** (relative, conditional, passive); raise the error-free-sentence ratio; control punctuation.
- 7→8: flexible, accurate complex structures; only rare, non-impeding errors.

**Always-flag failure patterns:** under length; bullet/note form; off-topic drift; no overview (T1 AC); missing position or half-answered prompt (T2); one repeated connector; complex sentences attempted but consistently faulty; spelling errors dense enough to slow reading; tone mismatch (GT letters).

---

## 8. Sources

Official (primary):
- IELTS Writing Band Descriptors (updated May 2023) — ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf
- IELTS Writing Key Assessment Criteria — ielts.org/cdn/ielts-guides/ielts-writing-key-assessment-criteria.pdf
- Understanding and setting IELTS scores — ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring
- IELTS scoring in detail (rounding rules) — ielts.org/take-a-test/your-results/ielts-scoring-in-detail
- IELTS Academic format: Writing (word counts, penalties, timing) — ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing

Supporting (format, essay types, lengths): British Council blog, IDP, and established prep sources, cross-checked against the official pages above.
