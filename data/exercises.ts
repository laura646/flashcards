export interface ExerciseQuestion {
  id: number
  prompt: string
  options: string[]
  correctIndex: number
  // If set, this question is in "select all that apply" mode.
  // Student sees checkboxes instead of radios; all-or-nothing scoring.
  // When this field is present, correctIndex is ignored.
  correctIndices?: number[]
  hint?: string
}

export interface Exercise {
  id: number
  title: string
  subtitle: string
  icon: string
  instructions: string
  questions: ExerciseQuestion[]
}

export const exercises: Exercise[] = [
  {
    id: 1,
    title: 'Prepositions',
    subtitle: 'Choose the correct option',
    icon: '📍',
    instructions: 'Choose the correct option, a, b or c.',
    questions: [
      {
        id: 1,
        prompt: 'Leave your dirty shoes ___ the room, please.',
        options: ['at', 'in', 'outside'],
        correctIndex: 2,
      },
      {
        id: 2,
        prompt: 'Where were you ___ Saturday?',
        options: ['on', 'in', 'at'],
        correctIndex: 0,
      },
      {
        id: 3,
        prompt: "I'll meet you ___ the entrance.",
        options: ['on', 'at', 'in'],
        correctIndex: 1,
      },
      {
        id: 4,
        prompt: 'The bus station is ___ the castle, on the right.',
        options: ['next to', 'on', 'inside'],
        correctIndex: 0,
      },
      {
        id: 5,
        prompt: 'You can buy food ___ the food tent.',
        options: ['on', 'near', 'in'],
        correctIndex: 2,
      },
      {
        id: 6,
        prompt: 'Is there a car park ___ here?',
        options: ['at', 'on', 'near'],
        correctIndex: 2,
      },
      {
        id: 7,
        prompt: 'Do you study ___ the morning?',
        options: ['in', 'at', 'on'],
        correctIndex: 0,
      },
      {
        id: 8,
        prompt: 'Why are all your books ___ the floor?',
        options: ['at', 'on', 'outside'],
        correctIndex: 1,
      },
      {
        id: 9,
        prompt: 'I usually wake up ___ 6 a.m.',
        options: ['on', 'in', 'at'],
        correctIndex: 2,
      },
      {
        id: 10,
        prompt: 'There are a lot of shops ___ my house.',
        options: ['on', 'inside', 'near'],
        correctIndex: 2,
      },
    ],
  },
  {
    id: 2,
    title: 'Correct the Mistake',
    subtitle: 'Find the error',
    icon: '✏️',
    instructions: 'Each sentence has a mistake. Choose the correct replacement for the underlined word.',
    questions: [
      {
        id: 1,
        prompt: 'Reena\'s café is *on* the city centre.',
        options: ['in', 'at', 'inside'],
        correctIndex: 0,
        hint: 'Replace "on"',
      },
      {
        id: 2,
        prompt: 'I watched a film *next to* my friend\'s house last night.',
        options: ['at', 'in', 'near'],
        correctIndex: 0,
        hint: 'Replace "next to"',
      },
      {
        id: 3,
        prompt: 'The children are *inside*, playing in the garden.',
        options: ['outside', 'near', 'at'],
        correctIndex: 0,
        hint: 'Replace "inside"',
      },
      {
        id: 4,
        prompt: 'The shop\'s closed *in* Mondays.',
        options: ['on', 'at', 'near'],
        correctIndex: 0,
        hint: 'Replace "in"',
      },
      {
        id: 5,
        prompt: 'The sports centre is *next of* the stadium.',
        options: ['next to', 'near of', 'on'],
        correctIndex: 0,
        hint: 'Replace "next of"',
      },
      {
        id: 6,
        prompt: 'My brother lives *inside* London.',
        options: ['in', 'at', 'on'],
        correctIndex: 0,
        hint: 'Replace "inside"',
      },
      {
        id: 7,
        prompt: 'Is there a post office *next to* here?',
        options: ['near', 'at', 'in'],
        correctIndex: 0,
        hint: 'Replace "next to"',
      },
      {
        id: 8,
        prompt: 'What do you usually do *in* the weekend?',
        options: ['at', 'on', 'near'],
        correctIndex: 0,
        hint: 'Replace "in"',
      },
    ],
  },
  {
    id: 3,
    title: 'Past Simple',
    subtitle: 'Choose the correct form',
    icon: '🔤',
    instructions: 'Choose the correct alternative.',
    questions: [
      {
        id: 1,
        prompt: 'I ___ all evening on Thursday.',
        options: ['studied', 'studed'],
        correctIndex: 0,
      },
      {
        id: 2,
        prompt: 'I ___ like apples when I was a child.',
        options: ["didn't", "don't"],
        correctIndex: 0,
      },
      {
        id: 3,
        prompt: 'We ___ a good film last weekend.',
        options: ['watched', 'watch'],
        correctIndex: 0,
      },
      {
        id: 4,
        prompt: 'She ___ call me yesterday.',
        options: ["doesn't", "didn't"],
        correctIndex: 1,
      },
      {
        id: 5,
        prompt: 'I ___ work early last Friday.',
        options: ['finish', 'finished'],
        correctIndex: 1,
      },
      {
        id: 6,
        prompt: 'I ___ English when I was a child.',
        options: ["didn't study", "didn't studied"],
        correctIndex: 0,
      },
      {
        id: 7,
        prompt: "Sorry I'm late, I ___ the bus this morning.",
        options: ['missed', 'miss'],
        correctIndex: 0,
      },
      {
        id: 8,
        prompt: 'I ___ when she told me.',
        options: ['cried', 'cryed'],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 4,
    title: 'Past Simple Verbs',
    subtitle: 'Complete the sentences',
    icon: '📝',
    instructions: 'Complete the sentences with the past simple form of the verb in brackets.',
    questions: [
      {
        id: 1,
        prompt: 'I ___ (play) football with my friends last weekend.',
        options: ['played', 'plaied', 'plaid'],
        correctIndex: 0,
      },
      {
        id: 2,
        prompt: 'Rosa ___ (want) to be a doctor when she was a child.',
        options: ['wanted', 'wantted', 'want'],
        correctIndex: 0,
      },
      {
        id: 3,
        prompt: 'I ___ (not dance) at the party.',
        options: ["didn't dance", "didn't danced", "not danced"],
        correctIndex: 0,
      },
      {
        id: 4,
        prompt: 'My dad ___ (cook) dinner for me yesterday.',
        options: ['cooked', 'cook', 'cokked'],
        correctIndex: 0,
      },
      {
        id: 5,
        prompt: 'They ___ (not invite) us to their party.',
        options: ["didn't invite", "didn't invited", "not invited"],
        correctIndex: 0,
      },
      {
        id: 6,
        prompt: 'We ___ (paint) our kitchen last week.',
        options: ['painted', 'paintted', 'paint'],
        correctIndex: 0,
      },
      {
        id: 7,
        prompt: 'I ___ (live) near the sea when I was a child.',
        options: ['lived', 'liveed', 'live'],
        correctIndex: 0,
      },
      {
        id: 8,
        prompt: 'He ___ (not listen) to classical music when he was a teenager.',
        options: ["didn't listen", "didn't listened", "not listened"],
        correctIndex: 0,
      },
      {
        id: 9,
        prompt: 'We ___ (talk) for hours last night.',
        options: ['talked', 'talkked', 'talk'],
        correctIndex: 0,
      },
      {
        id: 10,
        prompt: 'I ___ (not study) much for the exam.',
        options: ["didn't study", "didn't studied", "not study"],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 5,
    title: 'Complete the Story',
    subtitle: 'Fill in the text',
    icon: '📖',
    instructions: 'Complete the text with the past simple form of the verbs in the box: be, call, cook, invite, laugh, play, study, talk, try, watch.',
    questions: [
      {
        id: 1,
        prompt: 'Last weekend ___ great!',
        options: ['was', 'called', 'played', 'studied'],
        correctIndex: 0,
      },
      {
        id: 2,
        prompt: 'My friend ___ me on Saturday morning...',
        options: ['called', 'cooked', 'laughed', 'tried'],
        correctIndex: 0,
      },
      {
        id: 3,
        prompt: '...and ___ me to his house for dinner.',
        options: ['invited', 'talked', 'watched', 'studied'],
        correctIndex: 0,
      },
      {
        id: 4,
        prompt: 'He ___ a really nice meal...',
        options: ['cooked', 'called', 'played', 'was'],
        correctIndex: 0,
      },
      {
        id: 5,
        prompt: '...and I ___ a new kind of chocolate dessert — yum!',
        options: ['tried', 'talked', 'laughed', 'studied'],
        correctIndex: 0,
      },
      {
        id: 6,
        prompt: 'We ___ about our studies for a long time...',
        options: ['talked', 'watched', 'played', 'cooked'],
        correctIndex: 0,
      },
      {
        id: 7,
        prompt: '...then we ___ some comedy on TV. It was really funny...',
        options: ['watched', 'called', 'tried', 'was'],
        correctIndex: 0,
      },
      {
        id: 8,
        prompt: '...and I ___ a lot.',
        options: ['laughed', 'studied', 'played', 'invited'],
        correctIndex: 0,
      },
      {
        id: 9,
        prompt: 'I ___ on Sunday morning because I have a test this week.',
        options: ['studied', 'cooked', 'talked', 'was'],
        correctIndex: 0,
      },
      {
        id: 10,
        prompt: 'In the afternoon, I ___ tennis with my sister and I won!',
        options: ['played', 'called', 'tried', 'laughed'],
        correctIndex: 0,
      },
    ],
  },
]
