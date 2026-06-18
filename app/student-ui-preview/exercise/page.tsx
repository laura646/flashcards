'use client'

// Phase E verification harness — mounts the REAL ExerciseRunner (the quiz,
// brief §7) with a mock MCQ exercise so the quiz + result screens can be
// eyeballed without auth. Not linked; delete with other preview routes.

import ExerciseRunner from '@/components/ExerciseRunner'
import type { Exercise } from '@/data/exercises'

const MOCK: Exercise = {
  id: 1,
  title: 'Space Vocabulary Quiz',
  subtitle: 'Choose the correct answer',
  icon: '🎯',
  instructions: 'Pick the best answer for each question.',
  exercise_type: 'multiple_choice',
  questions: [
    { id: 1, prompt: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Mars', 'Earth'], correctIndex: 1, explanation: 'Mercury is the innermost planet.' },
    { id: 2, prompt: 'A galaxy is best described as ___', options: ['a single star', 'a system of stars, gas and dust', 'a planet with rings', 'a type of comet'], correctIndex: 1, explanation: 'Galaxies are vast gravitationally-bound systems.' },
  ],
} as unknown as Exercise

export default function ExercisePreview() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <ExerciseRunner exercise={MOCK} onComplete={() => {}} onBack={() => {}} />
      </div>
    </main>
  )
}
