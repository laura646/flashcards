// Shared (client-safe) constants, types and UI strings for exam mode.
//
// A lesson is a TEST when its lesson_type is one of TEST_LESSON_TYPES.
// Test settings live on the lessons row (see migration-test-mode.sql) and
// are teacher-configured per test in the lesson editor. `test_rules_lang`
// picks the language of every student-facing exam string below — Armenian
// (formal Դուք register) for lower levels, English for higher ones. The
// student can still flip the rules popup language locally.

export const TEST_LESSON_TYPES = ['mid_course_test', 'final_test', 'review_test'] as const

export function isTestLessonType(lessonType?: string | null): boolean {
  return !!lessonType && (TEST_LESSON_TYPES as readonly string[]).includes(lessonType)
}

export const DEFAULT_TEST_TIME_LIMIT_MIN = 30

export type TestLang = 'hy' | 'en'

export interface TestSettings {
  time_limit_minutes: number
  test_reveal_answers: boolean
  test_rules_lang: TestLang
}

export interface TestExerciseResult {
  exercise_id: string
  score: number
  total: number
  per_question_results: boolean[] | null
}

export type TestSessionState =
  | { status: 'none'; settings: TestSettings }
  | {
      status: 'in_progress'
      settings: TestSettings
      deadline: string
      server_now: string
      answers: Record<string, TestExerciseResult>
    }
  | {
      status: 'submitted'
      settings: TestSettings
      submitted_at: string
      auto_submitted: boolean
      score: number
      total: number
      answers: Record<string, TestExerciseResult>
    }
  | { status: 'legacy_completed' }

// ── Student-facing exam strings ──
// hy uses the polite Դուք register throughout (approved copy).

export const TEST_STRINGS = {
  hy: {
    rulesTitle: 'Թեստի կանոնները',
    rulesSub: 'Կարդացեք ուշադիր, ապա հաստատեք՝ սկսելու համար։',
    rules: (minutes: number) => [
      `Թեստը հանձնելու համար ունեք ${minutes} րոպե։ Ժամանակաչափը կսկսի «Համաձայն եմ, սկսել» կոճակը սեղմելուն պես և հնարավոր չէ դադարեցնել։`,
      'Ունեք միայն մեկ փորձ։',
      'Մինչև ժամանակի ավարտը կարող եք ազատ տեղաշարժվել վարժությունների միջև և փոխել Ձեր պատասխանները։',
      'Լսելու վարժությունների ձայնագրությունները կարող եք լսել անսահմանափակ անգամ։',
      'Էջը փակելը կամ թարմացնելը ՉԻ կանգնեցնում ժամանակաչափը։ Կարող եք վերադառնալ և շարունակել, քանի դեռ ժամանակը չի ավարտվել։',
      'Ժամանակի ավարտին թեստը կհանձնվի ավտոմատ, նույնիսկ եթե հարթակում չեք։',
      'Ճիշտ պատասխանները կտեսնեք միայն թեստը հանձնելուց հետո։',
      'Արգելվում է օգտվել բառարանից, նշումներից կամ կողմնակի օգնությունից։',
      'Ձեր արդյունքները կտեսնի Ձեր ուսուցիչը։',
    ],
    agreeStart: 'Համաձայն եմ, սկսել ▶',
    takeLater: 'Կհանձնեմ ավելի ուշ',
    laterNote: 'Լավ, թեստը կսպասի Ձեզ այստեղ։ Կարող եք սկսել, երբ պատրաստ լինեք։',
    timeLeft: 'Մնացած ժամանակ',
    saved: 'Պահպանված է ✓',
    minutesLeft15: '⏱ Մնացել է 15 րոպե',
    minutesLeft5: '⏰ Մնացել է ընդամենը 5 րոպե',
    statusAnswered: 'Պատասխանված',
    statusNotStarted: 'Չսկսված',
    changeAnswers: 'Փոխել պատասխանները',
    open: 'Բացել',
    submitTest: 'Հանձնել թեստը',
    confirmIncomplete:
      'Կան վարժություններ, որոնց դեռ չեք պատասխանել։ Վստա՞հ եք, որ ցանկանում եք հանձնել թեստը։',
    confirmComplete:
      'Վստա՞հ եք, որ ցանկանում եք հանձնել թեստը։ Հանձնելուց հետո պատասխանները փոխել այլևս հնարավոր չէ։',
    unansweredCount: (n: number) => `${n} վարժություն առանց պատասխանի`,
    yesSubmit: 'Այո, հանձնել',
    backToTest: 'Վերադառնալ թեստին',
    autoSubmitted: 'Ժամանակը սպառվեց — թեստը հանձնվեց ավտոմատ կերպով։',
    alreadyTaken: 'Դուք արդեն հանձնել եք այս թեստը։',
    yourAnswers: 'Ձեր պատասխանները',
    correctAnswerWas: 'Ճիշտ պատասխանը՝',
    timeUsed: 'Օգտագործված ժամանակ՝',
    resultsSaved:
      'Արդյունքը պահպանվել է և արդեն երևում է Ձեր առաջադիմության և դասընթացի հաշվետվությունների մեջ։ Ձեր ուսուցիչը նույնպես կտեսնի այն։',
    oneAttempt: '1 փորձ',
    minutesShort: 'րոպե',
    startTest: 'Սկսել թեստը',
    timeUp: 'Ժամանակն ավարտվել է',
  },
  en: {
    rulesTitle: 'Test rules',
    rulesSub: 'Read carefully, then confirm to start.',
    rules: (minutes: number) => [
      `You have ${minutes} minutes. The timer starts the moment you press “Agree & Start” and cannot be paused.`,
      'You have only one attempt.',
      'Until time runs out you can move freely between exercises and change your answers.',
      'You can replay listening audio an unlimited number of times.',
      'Closing or refreshing the page does NOT stop the timer. You can come back and continue while time remains.',
      'When time is up, the test is submitted automatically — even if you are not on the platform.',
      'You will see the correct answers only after you submit.',
      'Dictionaries, notes or outside help are not allowed.',
      'Your teacher will see your results.',
    ],
    agreeStart: 'Agree & Start ▶',
    takeLater: 'I’ll take it later',
    laterNote: 'No problem — the test will wait here until you’re ready.',
    timeLeft: 'Time left',
    saved: 'Saved ✓',
    minutesLeft15: '⏱ 15 minutes left',
    minutesLeft5: '⏰ Only 5 minutes left',
    statusAnswered: 'Answered',
    statusNotStarted: 'Not started',
    changeAnswers: 'Change answers',
    open: 'Open',
    submitTest: 'Submit test',
    confirmIncomplete:
      'There are exercises you haven’t completed. Are you sure you want to submit?',
    confirmComplete:
      'Are you sure you want to submit? Once you submit, you cannot change your answers.',
    unansweredCount: (n: number) => `${n} unanswered exercise${n === 1 ? '' : 's'}`,
    yesSubmit: 'Yes, submit',
    backToTest: 'Back to the test',
    autoSubmitted: 'Time ran out — your test was submitted automatically.',
    alreadyTaken: 'You have already taken this test.',
    yourAnswers: 'Your answers',
    correctAnswerWas: 'Correct answer:',
    timeUsed: 'Time used:',
    resultsSaved:
      'Your result is saved and already appears in your progress and course reports. Your teacher can see it too.',
    oneAttempt: '1 attempt',
    minutesShort: 'min',
    startTest: 'Start the test',
    timeUp: 'Time is up',
  },
} as const

export type TestStrings = (typeof TEST_STRINGS)['hy'] | (typeof TEST_STRINGS)['en']

export function testStrings(lang?: string | null): TestStrings {
  return lang === 'en' ? TEST_STRINGS.en : TEST_STRINGS.hy
}
