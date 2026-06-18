/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy admin palette — kept for backward compat in /admin until the
        // teacher-side redesign is its own pass.
        brand: {
          blue: '#416ebe',
          'blue-light': '#00aff0',
          yellow: '#ffeb00',
          dark: '#46464b',
          'bg-light': '#e6f0fa',
          'blue-pale': '#cddcf0',
        },
        // ── Student app "10B" tokens (design_handoff_student_app/README.md) ──
        sky: {
          DEFAULT: '#00aff0', // primary fill, hero, active icons, eyebrows, progress
          dark: '#0089c4',    // text on light-sky surfaces (secondary button text)
          wash: '#e6f6fe',    // quick-action tiles, segmented track, audio fills
          border: '#cfeafb',  // 1.5px borders on light-sky elements
        },
        brandblue: '#416ebe',       // word, screen headings, lesson titles (LOCKED rule: never on sky-wash)
        ink: {
          black: '#15161a',         // question text, list titles, meaning
          body: '#46464b',          // body, on-light-blue text
          // Darkened from the brief's #8b8f98 (3.2:1, fails WCAG AA) to
          // #6b7280 (~4.8:1 on white) so all the secondary copy that uses
          // this token — metadata, definitions, phonetics, subtitles — is
          // legible. Accessibility override of the brief's spec.
          muted: '#6b7280',         // metadata, captions, subtitles
        },
        hairline: '#ececef',        // card borders, dividers
        surface: '#f6f8fb',         // quiz sub-question panels
        streak: {
          fill: '#ffeb00',
          ink: '#5a4b00',
        },
        correct: {
          fg: '#16a34a',
          bg: '#e7f7ee',
          border: '#c3ebd4',
        },
        incorrect: {
          fg: '#e5484d',
          bg: '#fdecec',
          border: '#f6cdcf',
        },
        rating: {
          'again-bg': '#f1f2f4',
          'again-fg': '#6b7280',
          'hard-bg': '#eef0fb',
          'hard-fg': '#6a6fb0',
        },
        leitner: {
          // "New" = fresh/just-started, so a lively emerald (a sprout) rather
          // than grey. Slight teal undertone ties into the blue brand; the
          // ramp then climbs emerald → yellow → light-sky → sky → navy.
          new: '#10b981',
          learning: '#ffeb00',
          familiar: '#7fd4f5',
          known: '#00aff0',
          mastered: '#416ebe',
        },
      },
      fontFamily: {
        rubik: ['var(--font-rubik)', 'Rubik', 'sans-serif'],
      },
      borderRadius: {
        // Per brief: tiles/inputs 12-16, cards 18, flashcard 22, phone 34
        tile: '14px',
        card: '18px',
        flashcard: '22px',
        phone: '34px',
      },
      letterSpacing: {
        word: '-0.01em',
        hero: '-0.02em',
        eyebrow: '0.1em',
      },
    },
  },
  plugins: [],
}
