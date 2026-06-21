# IELTS Speaking — Mock-Interview App Build Spec

**For Claude Code.** Build an app that runs a full IELTS Speaking test (all 3 parts), acts as the examiner (asks the questions), records the candidate's **audio**, then estimates a band and gives improvement advice.

Grounded in the official IELTS sources (ielts.org): the **Speaking Band Descriptors**, the **Speaking Key Assessment Criteria**, and the official test format. Where something is an accepted approximation rather than an official rule, it's flagged.

> **IP note.** The official band descriptors are copyrighted by the IELTS Partners. This doc **restates** them as structured, analysable signals in our own words. Validate the grading engine against the source PDFs (Sources, §9).

> **Scope chosen:** audio input (so pronunciation + fluency can be judged), all three parts, examiner mode (the app asks the questions).

---

## 1. What the app does (high level)

A turn-based spoken loop, repeated across three parts:

1. **Examiner speaks** a question (text → speech).
2. **Candidate answers** out loud; the app **records** the turn.
3. App **transcribes** the audio with word-level timestamps.
4. App **extracts signals** — acoustic (for pronunciation + fluency) and linguistic (for vocabulary + grammar).
5. After the test, App **scores** the four criteria across all parts, estimates a band **range**, and generates **advice**.

The examiner must manage timing and follow the official structure (§3), and must **not coach** the candidate mid-test (authenticity). Feedback comes only at the end.

---

## 2. The four assessment criteria

Speaking is scored on four equally-weighted criteria (25% each):

| Criterion | What it measures | Needs audio? |
|---|---|---|
| **Fluency & Coherence (FC)** | Talking at a normal rate/continuity with little effort, and linking ideas into connected, logically ordered speech | **Yes** (timing) + transcript |
| **Lexical Resource (LR)** | Range, accuracy and appropriacy of vocabulary; ability to paraphrase around gaps | Transcript |
| **Grammatical Range & Accuracy (GRA)** | Range of structures and their accuracy at sentence level | Transcript |
| **Pronunciation (PR)** | Sustained use of phonological features (stress, rhythm, intonation, connected speech, clear sounds) for intelligible, meaningful speech | **Yes** (essential) |

Note: unlike Writing, Speaking combines fluency **and** coherence into one criterion, and adds **Pronunciation** — neither of which can be judged from text alone. This is why audio is required.

---

## 3. Test format & examiner behaviour (build the interview to this)

Official: a face-to-face interview, **recorded**, **11–14 minutes**, three parts, **identical for Academic and General Training**. The candidate is rated on **average performance across all parts**.

### Part 1 — Introduction & interview (4–5 min)
- Examiner introduces itself and (in a real test) checks ID — the app can skip ID or use it as a warm-up.
- Examiner asks general questions on **familiar topics**: home, family, work, studies, interests.
- Format: short question → short answer, several quick exchanges. Usually 2–3 sub-topics, 3–4 questions each.
- Tests: giving opinions/information on everyday topics.
- **Examiner engine:** pick 2–3 familiar topics; ask natural, simple questions; keep answers flowing; don't let any single answer run too long.

### Part 2 — Long turn / cue card (3–4 min incl. prep)
- Examiner gives a **task card**: a topic, 3–4 points to include, and one aspect to explain.
- Candidate gets **exactly 1 minute** to prepare (app shows a timer + a notes field).
- Candidate then talks for **1–2 minutes**; examiner stops them at 2 minutes.
- Examiner then asks **1–2 short follow-up questions** on the same topic.
- Tests: speaking at length, organising ideas logically, drawing on personal experience.
- **Examiner engine:** present the card; run a strict 60s prep timer; run a 2-minute talk timer (gently stop at 2:00); if the candidate stops before ~1:30, prompt once to continue; then ask 1–2 follow-ups. Common card themes: an object, a person, a place, an event, an activity.

### Part 3 — Discussion (4–5 min)
- A two-way discussion of **abstract / general** issues linked to the Part 2 topic, in greater depth.
- Tests: explaining opinions, analysing, discussing, speculating.
- **Examiner engine:** generate abstract questions thematically tied to the Part 2 card; probe with follow-ups ("Why do you think that?", "Do you think that will change?"); push for extended, reasoned answers; allow some back-and-forth.

### Cross-cutting examiner rules
- Keep a natural, friendly, conversational tone — not formal/academic.
- One question at a time; let the candidate finish.
- Adapt follow-ups to what the candidate actually said.
- Track elapsed time per part and overall (target 11–14 min).
- Never correct, coach, or react with approval/disapproval during the test.

---

## 4. Scoring model

### 4.1 Per-criterion banding
Score each of the four criteria 0–9 in 0.5 steps, based on the **whole test** (average performance across all parts), not a single answer.

Method: find the **highest band whose positive features are all met**, then lower it if a clear negative feature is present (the descriptors say a candidate "must fully fit the positive features of the descriptor at a particular level"). Combine signals — never decide from one metric.

**In-between bands.** Some bands are defined by reference to neighbours: Band 5 = "all positive features of Band 4 plus some (not all) of Band 6"; Band 7 = "all of Band 6 plus some of Band 8" (and similar for Pronunciation at 3/5/7). Implement this explicitly: award the odd band when the candidate is clearly above the lower even band but doesn't yet meet all of the higher even band's features.

### 4.2 Overall Speaking band
The four criteria are weighted equally; the Speaking band is their average, rounded to the nearest half band:

```
SpeakingBand = round_half( mean(FC, LR, GRA, PR) )

round_half(x): f = x − floor(x)
  if f < 0.25 → floor(x)
  if f < 0.75 → floor(x) + 0.5
  else        → floor(x) + 1.0
```

(The .25→half, .75→whole rule is the official overall-score rounding convention.)

### 4.3 Hard-rule overrides (check first)
| Condition | Effect |
|---|---|
| Did not attempt / no rateable language | Band 0–1 |
| Only isolated or memorised words | FC/LR/GRA at 1–2; flag memorised |
| Long stretches unintelligible | Caps PR (and usually FC) low |
| Off-topic throughout | Lowers FC coherence and overall |

---

## 5. Criteria in depth (the definition layer)

From the official Key Assessment Criteria — what each criterion actually rewards.

**Fluency & Coherence.** *Fluency:* speech rate (not too slow), continuity (few false starts, backtracks, functionless repetitions, or word-search pauses). *Coherence:* logical sequencing of spoken sentences; clear staging via pausing and discourse markers/fillers; relevance to the turn's purpose; cohesive devices (connectors, pronouns, conjunctions) within and between sentences.

**Lexical Resource.** Variety of words; appropriacy for referential meaning (correct labelling), style (formal/informal), collocation/idiom, and signalling attitude; ability to **paraphrase** around a vocabulary gap, with or without hesitation.

**Grammatical Range & Accuracy.** *Range:* length of spoken sentences; subordinate clauses; verb-phrase complexity (aspect, modality, passive); pre-/post-modification; variety of structures for information focus. *Accuracy:* error density; communicative effect of errors on intelligibility/precision.

**Pronunciation.** Dividing speech into meaningful **chunks**; rhythm and **stress-timing**, with linking/elision for connected speech; **stress and intonation** to enhance meaning; clear production of sounds at word/phoneme level (word stress, vowels, consonants); overall **effect of accent on intelligibility** and listener effort.

---

## 6. Band descriptors as analysable signals

The grading core. Each band restated as detectable signals. Read each as: *the highest band whose positive signals hold, with negative signals absent.* Bands 9–4 in detail; 3–1 summarised.

### 6.1 Fluency & Coherence (FC)
- **9** — Fluent; only rare repetition/self-correction; any hesitation is to plan content, not to hunt words/grammar; fully coherent, well-extended topic development; cohesion fully appropriate.
- **8** — Fluent; rare repetition/self-correction; occasional word/grammar-search hesitation but mostly content-related; coherent, relevant, appropriate development.
- **7** — Keeps going, produces long turns without noticeable effort; some hesitation/repetition/self-correction (often mid-sentence, accessing language) that does **not** harm coherence; flexible discourse markers and cohesion.
- **6** — Keeps going, willing to produce long turns; **coherence sometimes lost** through hesitation/repetition/self-correction; a range of discourse markers but **not always appropriate**.
- **5** — Usually keeps going but **relies on repetition/self-correction/slow speech**; hesitations often mid-sentence searching for basic words/grammar; **overuses** certain markers; complex speech causes disfluency though simple speech may be fluent.
- **4** — **Cannot keep going without noticeable pauses**; slow, with frequent repetition; often self-corrects; links simple sentences but with repetitious connectives; some coherence breakdowns.
- **3** — Frequent, sometimes long, pauses while searching for words; limited linking; often can't convey the basic message.
- **2** — Lengthy pauses before nearly every word; almost no communicative significance.
- **1** — Essentially none; speech totally incoherent.

**Signals (audio + timestamped transcript):** words-per-minute / syllables-per-second; pause count, length, and placement (mid-clause vs between clauses); **filled pauses** (um/uh) per minute; false starts; repetitions; self-corrections; **mean length of run** (words between pauses); discourse-marker variety vs **over-use ratio**; on-topic relevance; logical ordering of points; ability to sustain a 2-minute turn (Part 2).

### 6.2 Lexical Resource (LR)
- **9** — Total flexibility, precise in all contexts; sustained accurate, idiomatic language.
- **8** — Wide resource, ready and flexible across all topics; precise meaning; skilful less-common/idiomatic items despite occasional slips; effective paraphrase.
- **7** — Flexible across a variety of topics; **some** less-common/idiomatic items; style/collocation awareness, though inappropriacies occur; effective paraphrase.
- **6** — Enough to discuss topics **at length**; vocabulary sometimes inappropriate **but meaning clear**; generally paraphrases successfully.
- **5** — Enough for familiar **and** unfamiliar topics but **limited flexibility**; attempts paraphrase, **not always successfully**.
- **4** — Enough for familiar topics; only **basic** meaning on unfamiliar topics; frequent inappropriacies/errors in word choice; rarely attempts paraphrase.
- **3** — Limited to simple vocabulary mainly for personal information; inadequate for unfamiliar topics.
- **2** — Very limited; isolated or memorised words.
- **1** — No resource beyond a few isolated words.

**Signals (transcript):** vocabulary diversity (type–token); frequency band of words (common vs less-common); collocation accuracy; word-choice appropriacy/precision; **paraphrase events** (talking around a missing word); repetition; attitude/stance vocabulary.

### 6.3 Grammatical Range & Accuracy (GRA)
- **9** — Precise and accurate at all times, apart from native-like slips.
- **8** — Wide range, flexibly used; **majority of sentences error-free**; occasional inappropriacies/non-systematic errors; a few basic errors may persist.
- **7** — A range of structures flexibly used; **error-free sentences frequent**; both simple and complex sentences used effectively despite some errors; a few basic errors persist.
- **6** — Mix of short and complex forms with **limited flexibility**; errors **frequent in complex structures** but rarely impede communication.
- **5** — Basic forms **fairly well controlled**; complex structures attempted but limited in range, **nearly always contain errors**, may force reformulation.
- **4** — Basic forms with some short error-free utterances; subordinate clauses rare; short turns, repetitive structures, frequent errors.
- **3** — Basic forms attempted but numerous errors except in memorised utterances.
- **2** — No evidence of basic sentence forms.
- **1** — No rateable language unless memorised.

**Signals (transcript):** sentence/clause complexity; subordinate-clause rate; verb-phrase complexity (perfect/continuous aspect, modality, passive); pre-/post-modification; structure variety; grammar-error density and **gravity** (impedes meaning vs minor); error-free-clause ratio; reformulation events.

### 6.4 Pronunciation (PR) — audio required
- **9** — Full range of phonological features for precise/subtle meaning; sustained connected speech; effortless to understand throughout; accent has **no** effect on intelligibility.
- **8** — Wide range of features; sustained rhythm; flexible stress and intonation over long utterances with occasional lapses; **easily** understood; accent has **minimal** effect.
- **7** — All positive features of Band 6 **plus some (not all)** of Band 8.
- **6** — A range of features but **variable control**; chunking generally appropriate but rhythm affected by weak stress-timing and/or **rapid rate**; some effective intonation/stress but **not sustained**; occasional mispronounced words/phonemes causing **occasional** unclarity; generally understood without much effort.
- **5** — All positive features of Band 4 **plus some** of Band 6.
- **4** — Some acceptable features but **limited range**; some acceptable chunking with **frequent rhythm lapses**; limited intonation/stress control; **frequent** mispronunciation causing unclarity; understanding needs effort and some patches are unintelligible.
- **3** — Features of Band 2 **plus some** of Band 4.
- **2** — Few acceptable features; delivery impairs connected speech; mainly mispronounced; **often unintelligible**.
- **1** — Only occasional recognisable words/phonemes; unintelligible.

**Signals (audio):** chunking/pausing at meaningful boundaries; rhythm and **stress-timing** regularity; connected-speech features (linking, elision); **word and sentence stress** placement; intonation contours used for meaning (e.g., pitch movement on focus words); **phoneme/word accuracy** and confidence; **intelligibility / listener effort**; overall effect of accent. Note the heavy use of **in-between bands** (3, 5, 7) here.

---

## 7. The audio pipeline (key engineering)

This is what makes Speaking different from Writing. Suggested flow:

1. **Examiner TTS.** Convert each examiner question to speech (any natural TTS). Keep a friendly, even pace.
2. **Capture.** Record the candidate's turn as audio; store per-turn clips tagged with part number and question.
3. **ASR with word timestamps.** Transcribe each clip with **word-level timing** (e.g., a Whisper-class model with timestamps). Timestamps are mandatory — they drive fluency and pronunciation analysis.
4. **Acoustic feature extraction** (for FC + PR):
   - speech rate (words/min, syllables/sec), articulation rate (excluding pauses)
   - pause inventory: count, durations, positions; silent vs filled pauses
   - mean length of run; false starts / repeats / self-corrections (from transcript + timing)
   - stress, rhythm, intonation, and phoneme-level accuracy — via a pronunciation/forced-alignment model **or** an **audio-capable LLM** that accepts the clip directly.
5. **Linguistic analysis** (for LR + GRA) from the transcript: diversity, collocations, structures, errors, paraphrase/reformulation events.
6. **Assessment.** Pass the per-turn transcripts + extracted features (and, ideally, the audio itself for PR) to the grading model (§8).

**Pronunciation honesty.** Automated pronunciation scoring is the hardest and least reliable part. Intelligibility and "accent effect" are partly subjective, and ASR can mis-hear strong accents (penalising unfairly). Treat PR as **approximate**, lean on an audio-capable model rather than transcript text, and **never** mark down purely because the ASR struggled. Calibrate against officially-scored samples before trusting PR output.

---

## 8. Analysis & grading engine

**Inputs:** per-turn transcripts with timestamps, extracted acoustic + linguistic features, and (for PR) the audio clips. The Part 2 long turn is the richest evidence for FC and GRA range; Part 3 is the richest for LR and GRA under cognitive load.

**Procedure:**
1. Apply hard-rule overrides (§4.3).
2. For each criterion, aggregate signals **across all parts** and band by rubric matching (§6), using the in-between-band logic.
3. Compute the Speaking band as the mean of the four, rounded half (§4.2).
4. Output a band **range** (e.g., 6.0–6.5) plus a confidence level; lower confidence when audio quality is poor, the sample is short, or memorisation/accent-ASR issues are suspected.

**Suggested JSON output (for the app to render):**
```json
{
  "overall": { "band_estimate": 6.5, "band_range": [6.0, 7.0], "confidence": "medium" },
  "criteria": {
    "fluency_coherence":        { "band": 6.5, "evidence": "string", "issues": ["string"] },
    "lexical_resource":         { "band": 6.0, "evidence": "string", "issues": ["string"] },
    "grammatical_range_accuracy":{ "band": 6.5, "evidence": "string", "issues": ["string"] },
    "pronunciation":            { "band": 6.0, "evidence": "string", "issues": ["string"], "reliability": "approximate" }
  },
  "by_part": {
    "part1": { "notes": "string" },
    "part2": { "talk_seconds": 105, "sustained_two_min": true, "notes": "string" },
    "part3": { "notes": "string" }
  },
  "fluency_metrics": {
    "words_per_minute": 0, "filled_pauses_per_min": 0, "mean_length_of_run": 0,
    "long_pauses": 0, "self_corrections": 0
  },
  "advice": [
    { "criterion": "string", "priority": 1, "lever": "concrete action", "example": { "said": "candidate's words", "better": "improved version" } }
  ],
  "summary": "2–3 plain-language sentences the learner can act on"
}
```

**Calibration cautions:** reward communicative effect, not surface features — fast speech, long words, or many connectors that are misused score **lower**, not higher; error **gravity** matters more than count; detect memorised/templated answers (fluent but low-scoring). Validate the whole engine against a set of officially-scored sample performances and tune until estimates land within half a band.

---

## 9. Advice generation

Target the weakest criteria first, aimed at the next band up.

**Fluency & Coherence**
- 6→7: reduce mid-sentence word-search pauses by simplifying phrasing; stop over-using one or two connectors; sustain the Part 2 turn for the full 2 minutes; sequence points clearly (signpost stages).
- 7→8: let hesitation be for content, not language; smoother, more varied cohesion.

**Lexical Resource**
- 6→7: add some less-common and topic-specific words used **accurately**; fix collocations; show paraphrase when a word is missing instead of stalling.
- 7→8: precise, natural idiomatic use; flexible across any topic.

**Grammatical Range & Accuracy**
- 6→7: use complex structures (relative, conditional, perfect/continuous aspect, passive) **accurately**; raise the error-free-sentence ratio.
- 7→8: flexible, accurate complex grammar with only rare, non-impeding errors.

**Pronunciation**
- 6→7: stabilise rhythm and stress-timing; slow a rapid rate; use stress and intonation on focus words to carry meaning; fix the specific phonemes that recur as unclear.
- 7→8: sustain features across long utterances; minimal lapses; accent has minimal effect on understanding.

**Always-flag patterns:** can't sustain the Part 2 long turn; frequent long pauses or filled pauses; over-using one connector; complex sentences attempted but consistently faulty; recurring mispronunciations that force listener effort; memorised-sounding answers; going off-topic in Part 3.

---

## 10. Sources

Official (primary):
- IELTS Speaking Band Descriptors — ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf
- IELTS Speaking Key Assessment Criteria — ielts.org/cdn/ielts-guides/ielts-speaking-key-assessment-criteria.pdf
- IELTS Academic format: Speaking (structure, timing) — ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking
- Understanding and setting IELTS scores; IELTS scoring in detail (rounding) — ielts.org

Supporting (format, cue-card practice, timing): British Council practice pages and established prep sources, cross-checked against the official pages above.

---

## 11. Build order (suggested for Claude Code)

1. Examiner engine + interview flow (3 parts, timers, question generation) with text first.
2. Add TTS for the examiner and audio capture for the candidate.
3. Add ASR with word timestamps; store per-turn clips + transcripts.
4. Add fluency/acoustic feature extraction; add linguistic analysis.
5. Add the grading model (criteria banding → range + advice) using the schema in §8.
6. Calibrate against officially-scored samples; tune; then ship.
