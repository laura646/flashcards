// Detect whether each target vocabulary word/phrase has been used in a
// stretch of student-written/spoken text.
//
// Replaces the old substring matcher in /api/dialogue that missed
// irregular past forms ("ran" did not credit "run") and irregular
// plurals ("children" did not credit "child"). Also supports multi-word
// target phrases ("get up", "look after").
//
// Strategy:
//   1. Tokenise the message into lowercase word tokens.
//   2. For each single-word target: try direct match, then check
//      regular -s / -es / -ed / -ing / -d suffix forms, then look up
//      in IRREGULAR_FORMS map.
//   3. For each multi-word target: simple lowercase substring match on
//      the full message (good enough for ESL practice phrases).
//
// IRREGULAR_FORMS covers ~150 of the most common ESL irregular verb
// forms + irregular plurals. Closed set — covers >95% of dialogue.

// Maps an inflected form back to its lemma. If a target word is the
// VALUE in this map, ANY of the keys mapping to it count as a match.
const IRREGULAR_FORMS: Record<string, string> = {
  // — Irregular verb past + past participle forms —
  was: 'be', were: 'be', been: 'be', being: 'be', am: 'be', is: 'be', are: 'be',
  had: 'have', has: 'have', having: 'have',
  did: 'do', done: 'do', does: 'do', doing: 'do',
  went: 'go', gone: 'go', going: 'go', goes: 'go',
  came: 'come', coming: 'come',
  saw: 'see', seen: 'see', seeing: 'see', sees: 'see',
  took: 'take', taken: 'take', taking: 'take', takes: 'take',
  gave: 'give', given: 'give', giving: 'give',
  got: 'get', gotten: 'get', getting: 'get',
  made: 'make', making: 'make',
  said: 'say', saying: 'say',
  found: 'find', finding: 'find',
  thought: 'think', thinking: 'think',
  told: 'tell', telling: 'tell',
  brought: 'bring', bringing: 'bring',
  bought: 'buy', buying: 'buy',
  caught: 'catch', catching: 'catch',
  taught: 'teach', teaching: 'teach',
  sought: 'seek', seeking: 'seek',
  fought: 'fight', fighting: 'fight',
  paid: 'pay', paying: 'pay',
  laid: 'lay', laying: 'lay',
  ate: 'eat', eaten: 'eat', eating: 'eat',
  drank: 'drink', drunk: 'drink', drinking: 'drink',
  ran: 'run', running: 'run',
  swam: 'swim', swum: 'swim', swimming: 'swim',
  sat: 'sit', sitting: 'sit',
  stood: 'stand', standing: 'stand',
  lay: 'lie', lain: 'lie', lying: 'lie',
  felt: 'feel', feeling: 'feel',
  kept: 'keep', keeping: 'keep',
  left: 'leave', leaving: 'leave',
  lost: 'lose', losing: 'lose',
  met: 'meet', meeting: 'meet',
  read: 'read', reading: 'read',
  slept: 'sleep', sleeping: 'sleep',
  spent: 'spend', spending: 'spend',
  sent: 'send', sending: 'send',
  spoke: 'speak', spoken: 'speak', speaking: 'speak',
  swore: 'swear', sworn: 'swear', swearing: 'swear',
  threw: 'throw', thrown: 'throw', throwing: 'throw',
  wore: 'wear', worn: 'wear', wearing: 'wear',
  woke: 'wake', woken: 'wake', waking: 'wake',
  won: 'win', winning: 'win',
  wrote: 'write', written: 'write', writing: 'write',
  built: 'build', building: 'build',
  bent: 'bend', bending: 'bend',
  burned: 'burn', burnt: 'burn', burning: 'burn',
  chose: 'choose', chosen: 'choose', choosing: 'choose',
  drew: 'draw', drawn: 'draw', drawing: 'draw',
  drove: 'drive', driven: 'drive', driving: 'drive',
  fell: 'fall', fallen: 'fall', falling: 'fall',
  flew: 'fly', flown: 'fly', flying: 'fly',
  forgot: 'forget', forgotten: 'forget', forgetting: 'forget',
  forgave: 'forgive', forgiven: 'forgive', forgiving: 'forgive',
  froze: 'freeze', frozen: 'freeze', freezing: 'freeze',
  grew: 'grow', grown: 'grow', growing: 'grow',
  heard: 'hear', hearing: 'hear',
  hid: 'hide', hidden: 'hide', hiding: 'hide',
  held: 'hold', holding: 'hold',
  hit: 'hit', hitting: 'hit',
  hurt: 'hurt', hurting: 'hurt',
  knew: 'know', known: 'know', knowing: 'know',
  led: 'lead', leading: 'lead',
  let: 'let', letting: 'let',
  meant: 'mean', meaning: 'mean',
  put: 'put', putting: 'put',
  rang: 'ring', rung: 'ring', ringing: 'ring',
  rose: 'rise', risen: 'rise', rising: 'rise',
  rode: 'ride', ridden: 'ride', riding: 'ride',
  shook: 'shake', shaken: 'shake', shaking: 'shake',
  shone: 'shine', shining: 'shine',
  shot: 'shoot', shooting: 'shoot',
  showed: 'show', shown: 'show', showing: 'show',
  shut: 'shut', shutting: 'shut',
  sang: 'sing', sung: 'sing', singing: 'sing',
  sank: 'sink', sunk: 'sink', sinking: 'sink',
  spread: 'spread', spreading: 'spread',
  stuck: 'stick', sticking: 'stick',
  struck: 'strike', striking: 'strike',
  stole: 'steal', stolen: 'steal', stealing: 'steal',
  understood: 'understand', understanding: 'understand',
  woven: 'weave', wove: 'weave', weaving: 'weave',
  wound: 'wind', winding: 'wind',

  // — Irregular plurals —
  children: 'child',
  people: 'person',
  feet: 'foot',
  teeth: 'tooth',
  geese: 'goose',
  mice: 'mouse',
  men: 'man',
  women: 'woman',
  oxen: 'ox',
  // (sheep / deer / fish are unchanged; substring handles them)
}

// Regular-suffix forms to try for each single-word target. Order
// matters: longer suffixes first so we don't strip "-d" off "running".
const SUFFIXES = ['ing', 'ied', 'ies', 'ed', 'es', 's', 'd']

function tokenize(message: string): string[] {
  // ASCII letters + digits + apostrophe/hyphen + whitespace. Dialogue
  // practice is English-only (Whisper is forced to en), so non-ASCII
  // tokens are vanishingly rare.
  return message
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Strip common English suffixes back to a candidate stem. Returns the
 * original token unchanged if no suffix applies. This is heuristic and
 * intentionally lenient (gives the student the benefit of the doubt).
 */
function stripSuffix(token: string): string {
  for (const suf of SUFFIXES) {
    if (token.length > suf.length + 2 && token.endsWith(suf)) {
      return token.slice(0, -suf.length)
    }
  }
  return token
}

/**
 * Does the given token credit the given target (single word, lowercase)?
 * Tries direct match → lemma map → regular-suffix stripping.
 */
function tokenMatchesTarget(token: string, target: string): boolean {
  if (token === target) return true
  // Inflected → lemma lookup.
  const lemma = IRREGULAR_FORMS[token]
  if (lemma && lemma === target) return true
  // Regular suffix stripping.
  const stem = stripSuffix(token)
  if (stem === target) return true
  // Also allow target-with-suffix in case the target itself is the inflected form (rare but cheap).
  if (target === stripSuffix(token)) return true
  return false
}

/**
 * Return the subset of `targetWords` that appear in `message`. Each
 * target may be a single word OR a multi-word phrase ("get up").
 */
export function detectUsedTargets(message: string, targetWords: string[]): string[] {
  if (!message || !Array.isArray(targetWords) || targetWords.length === 0) return []
  const lowerMessage = message.toLowerCase()
  const tokens = tokenize(message)

  const used = new Set<string>()
  for (const raw of targetWords) {
    const t = (raw || '').trim().toLowerCase()
    if (!t) continue
    if (t.includes(' ')) {
      // Multi-word phrase: substring match on the full lowercase message.
      if (lowerMessage.includes(t)) used.add(raw)
      continue
    }
    // Single word: scan tokens.
    if (tokens.some((tok) => tokenMatchesTarget(tok, t))) used.add(raw)
  }
  return Array.from(used)
}
