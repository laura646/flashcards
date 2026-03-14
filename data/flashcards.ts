export interface Flashcard {
  id: number
  word: string
  phonetic: string
  meaning: string
  example: string
  notes?: string
}

export const flashcards: Flashcard[] = [
  {
    id: 1,
    word: 'camping area',
    phonetic: 'KAM-ping EH-ree-uh',
    meaning: 'A large area at a festival or outdoor event with spaces to set up tents and stay overnight.',
    example: 'We found a great spot in the camping area near the main stage.',
    notes: 'Often used in the context of music festivals.',
  },
  {
    id: 2,
    word: 'stage',
    phonetic: 'stayj',
    meaning: 'A raised platform where performers such as musicians or speakers perform in front of an audience.',
    example: 'The band walked onto the stage and the crowd started cheering.',
  },
  {
    id: 3,
    word: 'festival',
    phonetic: 'FES-ti-vul',
    meaning: 'An organized outdoor event with various activities such as music, food, and entertainment.',
    example: 'We went to a music festival last summer and had an amazing time.',
  },
  {
    id: 4,
    word: 'castle',
    phonetic: 'KAH-sul',
    meaning: 'A large, old fortified building with thick walls and towers, usually built in the Middle Ages.',
    example: 'We visited an old castle in Scotland during our holiday.',
  },
  {
    id: 5,
    word: 'consonant',
    phonetic: 'KON-suh-nunt',
    meaning: 'A speech sound that is not a vowel — for example: B, C, D, F, G.',
    example: 'The word "string" starts with three consonants: S, T, and R.',
  },
  {
    id: 6,
    word: 'vowel',
    phonetic: 'VOW-ul',
    meaning: 'One of the open speech sounds: A, E, I, O, or U.',
    example: 'Every English word has at least one vowel.',
  },
  {
    id: 7,
    word: 'syllable',
    phonetic: 'SIL-uh-bul',
    meaning: 'A unit of pronunciation that forms a single, unbroken sound in a word.',
    example: 'The word "syllable" itself has three syllables: syl-la-ble.',
  },
  {
    id: 8,
    word: 'at all',
    phonetic: 'at AWL',
    meaning: 'Not even a little bit — used to add emphasis to a negative statement.',
    example: 'I didn\'t enjoy the film at all. It was very boring.',
  },
  {
    id: 9,
    word: 'renovate',
    phonetic: 'REN-uh-vayt',
    meaning: 'To make a building, room, or space look new or modern again by improving it.',
    example: 'They decided to renovate the kitchen and add new cabinets.',
    notes: 'Compare with "repair" — renovate = make modern; repair = fix something broken.',
  },
  {
    id: 10,
    word: 'repair',
    phonetic: 'rih-PAIR',
    meaning: 'To fix something that is broken or damaged so it works again.',
    example: 'I need to repair my bicycle — the wheel is broken.',
    notes: 'Compare with "renovate" — repair = fix broken things; renovate = update a space.',
  },
  {
    id: 11,
    word: 'build',
    phonetic: 'bild',
    meaning: 'To construct something — especially a building or structure — from the ground up.',
    example: 'They are going to build a new school in our neighbourhood.',
    notes: 'Compare with "create" — build = physical construction; create = artistic/abstract.',
  },
  {
    id: 12,
    word: 'chandelier',
    phonetic: 'shan-duh-LEER',
    meaning: 'A large, decorative hanging light fixture, often with many arms and glass pieces.',
    example: 'There was a beautiful chandelier in the centre of the ballroom.',
    notes: 'French origin. Common pronunciation challenge — not "Chandler" or "candelier".',
  },
  {
    id: 13,
    word: 'sauna',
    phonetic: 'SAW-nuh',
    meaning: 'A small heated room used for relaxation, where people sit in high temperatures.',
    example: 'After the gym, he relaxed in the sauna for twenty minutes.',
  },
  {
    id: 14,
    word: 'Edinburgh',
    phonetic: 'ED-in-bruh',
    meaning: 'The capital city of Scotland, in the United Kingdom.',
    example: 'Edinburgh is famous for its castle, its festival, and its beautiful old streets.',
    notes: 'The "-burgh" ending is not pronounced as written — it sounds like "-bruh".',
  },
  {
    id: 15,
    word: 'stay up',
    phonetic: 'stay UP',
    meaning: 'To remain awake and not go to sleep, usually later than usual.',
    example: 'I stayed up until midnight watching the match.',
    notes: 'Phrasal verb.',
  },
  {
    id: 16,
    word: 'event',
    phonetic: 'ih-VENT',
    meaning: 'An organised occasion such as a concert, party, sports match, or ceremony.',
    example: 'The sports event attracted thousands of fans from around the world.',
    notes: 'Stress is on the second syllable: ih-VENT.',
  },
  {
    id: 17,
    word: 'cheer',
    phonetic: 'cheer',
    meaning: 'To shout loudly in support or encouragement, especially at a sports event.',
    example: 'The crowd began to cheer when their team scored a goal.',
  },
  {
    id: 18,
    word: 'loud / loudly',
    phonetic: 'lowd / LOWD-lee',
    meaning: 'Loud (adjective) describes a noun — something that makes a lot of noise. Loudly (adverb) describes how an action is done.',
    example: 'The music was very loud. / The music played very loudly.',
    notes: 'After a linking verb like "was" or "is", use the adjective: "It was loud." NOT "It was loudly."',
  },
  {
    id: 19,
    word: 'impression',
    phonetic: 'im-PRESH-un',
    meaning: 'An idea, feeling, or opinion you form about something or someone.',
    example: 'The new teacher made a great impression on the students.',
    notes: 'NOT a synonym for excitement or happiness. "I got an impression" means you formed an opinion.',
  },
]
