'use client'

import { useState } from 'react'
import ExerciseRunner from '@/components/ExerciseRunner'
import TrueOrFalseRunner from '@/components/TrueOrFalseRunner'
import HangmanRunner from '@/components/HangmanRunner'
import TypeAnswerRunner from '@/components/TypeAnswerRunner'
import CompleteSentenceRunner from '@/components/CompleteSentenceRunner'
import GroupSortRunner from '@/components/GroupSortRunner'
import DictationRunner from '@/components/DictationRunner'
import ErrorCorrectionRunner from '@/components/ErrorCorrectionRunner'
import RankOrderRunner from '@/components/RankOrderRunner'
import TextSequencingRunner from '@/components/TextSequencingRunner'
import AnagramRunner from '@/components/AnagramRunner'
import ClozeListeningRunner from '@/components/ClozeListeningRunner'
import MatchHalvesRunner from '@/components/MatchHalvesRunner'
import OddOneOutRunner from '@/components/OddOneOutRunner'

interface ExercisePreviewProps {
  exercise: {
    title: string
    subtitle?: string
    icon?: string
    instructions: string
    exercise_type: string
    questions: unknown
    groupData?: unknown
  }
  onClose: () => void
}

export default function ExercisePreview({ exercise, onClose }: ExercisePreviewProps) {
  const [key, setKey] = useState(0) // for resetting the runner

  const exProps = {
    title: exercise.title,
    instructions: exercise.instructions || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    questions: (exercise.questions || []) as any[],
  }

  const handleComplete = () => {
    // no-op in preview — student score not tracked
  }

  const handleRestart = () => {
    setKey(k => k + 1)
  }

  let runner: React.ReactNode
  switch (exercise.exercise_type) {
    case 'true_or_false':
      runner = <TrueOrFalseRunner key={key} exercise={exProps} onComplete={handleComplete} onBack={onClose} />
      break
    case 'hangman':
      runner = <HangmanRunner key={key} exercise={exProps} onComplete={handleComplete} onBack={onClose} />
      break
    case 'type_answer':
      runner = <TypeAnswerRunner key={key} exercise={exProps} onComplete={handleComplete} onBack={onClose} />
      break
    case 'complete_sentence':
      runner = <CompleteSentenceRunner key={key} exercise={exProps} onComplete={handleComplete} onBack={onClose} />
      break
    case 'group_sort':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runner = <GroupSortRunner key={key} exercise={{ title: exProps.title, instructions: exProps.instructions, groupData: (exercise.groupData || exercise.questions) as any }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'dictation':
      runner = <DictationRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and type what you hear.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'error_correction':
      runner = <ErrorCorrectionRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Find and correct the errors.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'rank_order':
      runner = <RankOrderRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Rank the items in the correct order.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'text_sequencing':
      runner = <TextSequencingRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Arrange the segments in the correct order.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'anagram':
      runner = <AnagramRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Unscramble to form the correct answer.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'cloze_listening':
      runner = <ClozeListeningRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and fill in the missing words.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'match_halves':
      runner = <MatchHalvesRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Match the halves.' }} onComplete={handleComplete} onBack={onClose} />
      break
    case 'odd_one_out':
      runner = <OddOneOutRunner key={key} exercise={{ ...exProps, instructions: exProps.instructions || 'Find the word or phrase that doesn\'t belong.' }} onComplete={handleComplete} onBack={onClose} />
      break
    default:
      runner = <ExerciseRunner key={key} exercise={{ id: 0, title: exercise.title, subtitle: exercise.subtitle || '', icon: exercise.icon || '📝', instructions: exercise.instructions, questions: exProps.questions }} onComplete={handleComplete} onBack={onClose} />
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-[#f0f4fa] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e6f0fa]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#416ebe]">Student Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="text-xs text-gray-400 hover:text-[#416ebe] font-bold px-2 py-1 rounded-lg hover:bg-[#e6f0fa] transition-colors"
            >
              ↻ Restart
            </button>
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-red-400 font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Runner */}
        <div className="flex-1 overflow-y-auto p-5">
          {runner}
        </div>
      </div>
    </div>
  )
}
