'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AnagramQuestion {
  id: number
  word: string   // single word → letter mode, has spaces → sentence mode
  clue?: string
  image_url?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: AnagramQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

interface Tile {
  id: string
  text: string       // a single letter or a whole word
  originalIndex: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isSentenceMode(word: string) {
  return word.trim().includes(' ')
}

function buildTiles(word: string): Tile[] {
  if (isSentenceMode(word)) {
    const words = word.trim().split(/\s+/)
    const tiles = words.map((w, i) => ({ id: `w-${i}`, text: w, originalIndex: i }))
    const shuffled = shuffle(tiles)
    // Ensure not in original order
    if (shuffled.length > 1 && shuffled.every((t, i) => t.originalIndex === i)) {
      ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
    }
    return shuffled
  } else {
    const letters = word.toUpperCase().split('')
    const tiles = letters.map((ch, i) => ({ id: `l-${i}`, text: ch, originalIndex: i }))
    const shuffled = shuffle(tiles)
    if (shuffled.length > 1 && shuffled.every((t, i) => t.originalIndex === i)) {
      ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
    }
    return shuffled
  }
}

function checkAnswer(placed: Tile[], word: string): boolean {
  if (isSentenceMode(word)) {
    const target = word.trim().split(/\s+/)
    if (placed.length !== target.length) return false
    return placed.every((t, i) => t.text === target[i])
  } else {
    const target = word.toUpperCase()
    if (placed.length !== target.length) return false
    return placed.map(t => t.text).join('') === target
  }
}

export default function AnagramRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pool, setPool] = useState<Tile[]>([])       // scrambled tiles (not yet placed)
  const [placed, setPlaced] = useState<Tile[]>([])    // tiles in the answer area
  const [results, setResults] = useState<(boolean | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [shake, setShake] = useState(false)
  const [dragTile, setDragTile] = useState<{ id: string; from: 'pool' | 'placed' } | null>(null)

  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = exercise.questions[currentIndex]
  const sentenceMode = current ? isSentenceMode(current.word) : false
  const targetLength = current ? (sentenceMode ? current.word.trim().split(/\s+/).length : current.word.length) : 0

  // Reset tiles when question changes
  useEffect(() => {
    if (!current) return
    setPool(buildTiles(current.word))
    setPlaced([])
    setFeedback(null)
    setRevealed(false)
    setShake(false)
  }, [currentIndex])

  // Cleanup timer
  useEffect(() => {
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current) }
  }, [])

  // Auto-check when all tiles are placed
  useEffect(() => {
    if (!current || placed.length !== targetLength || feedback !== null) return
    const correct = checkAnswer(placed, current.word)
    if (correct) {
      setFeedback('correct')
      const newResults = [...results]
      newResults[currentIndex] = true
      setResults(newResults)
      autoTimer.current = setTimeout(() => advance(newResults), 1500)
    }
  }, [placed.length])

  const submitAnswer = useCallback(() => {
    if (!current || placed.length !== targetLength || feedback !== null) return
    const correct = checkAnswer(placed, current.word)
    if (correct) {
      setFeedback('correct')
      const newResults = [...results]
      newResults[currentIndex] = true
      setResults(newResults)
      autoTimer.current = setTimeout(() => advance(newResults), 1500)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      setFeedback('wrong')
      setRevealed(true)
      const newResults = [...results]
      newResults[currentIndex] = false
      setResults(newResults)
    }
  }, [current, placed, targetLength, feedback, results, currentIndex])

  if (!exercise.questions || exercise.questions.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No questions in this exercise.</div>
  }

  const answeredCount = results.filter(r => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  // ── Tile interactions ──

  const tapPoolTile = (tile: Tile) => {
    if (feedback !== null) return
    setPool(prev => prev.filter(t => t.id !== tile.id))
    setPlaced(prev => [...prev, tile])
  }

  const tapPlacedTile = (tile: Tile) => {
    if (feedback !== null) return
    setPlaced(prev => prev.filter(t => t.id !== tile.id))
    setPool(prev => [...prev, tile])
  }

  // Drag & drop handlers
  const handleDragStart = (tile: Tile, from: 'pool' | 'placed') => {
    setDragTile({ id: tile.id, from })
  }

  const handleDropOnPlaced = (dropIndex: number) => {
    if (!dragTile || feedback !== null) return
    if (dragTile.from === 'pool') {
      // Move from pool to placed at specific position
      const tile = pool.find(t => t.id === dragTile.id)
      if (!tile) return
      setPool(prev => prev.filter(t => t.id !== dragTile.id))
      setPlaced(prev => {
        const next = [...prev]
        next.splice(dropIndex, 0, tile)
        return next
      })
    } else {
      // Reorder within placed
      const fromIdx = placed.findIndex(t => t.id === dragTile.id)
      if (fromIdx === -1 || fromIdx === dropIndex) return
      setPlaced(prev => {
        const next = [...prev]
        const [moved] = next.splice(fromIdx, 1)
        next.splice(dropIndex > fromIdx ? dropIndex - 1 : dropIndex, 0, moved)
        return next
      })
    }
    setDragTile(null)
  }

  const handleDropOnPool = () => {
    if (!dragTile || feedback !== null) return
    if (dragTile.from === 'placed') {
      const tile = placed.find(t => t.id === dragTile.id)
      if (!tile) return
      setPlaced(prev => prev.filter(t => t.id !== dragTile.id))
      setPool(prev => [...prev, tile])
    }
    setDragTile(null)
  }

  const handleDropOnPlacedEnd = () => {
    if (!dragTile || feedback !== null) return
    if (dragTile.from === 'pool') {
      const tile = pool.find(t => t.id === dragTile.id)
      if (!tile) return
      setPool(prev => prev.filter(t => t.id !== dragTile.id))
      setPlaced(prev => [...prev, tile])
    }
    setDragTile(null)
  }

  const resetTiles = () => {
    if (feedback === 'correct') return
    setPool(buildTiles(current.word))
    setPlaced([])
    setFeedback(null)
    setRevealed(false)
  }

  const showAnswer = () => {
    if (feedback === 'correct') return
    setRevealed(true)
    setFeedback('wrong')
    const newResults = [...results]
    newResults[currentIndex] = false
    setResults(newResults)
  }

  const advance = (latestResults: (boolean | null)[]) => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current)
      autoTimer.current = null
    }
    const allDone = latestResults.every(r => r !== null)
    if (allDone) {
      setFinished(true)
      const score = latestResults.filter(r => r === true).length
      onComplete(score, exercise.questions.length)
      return
    }
    let next = currentIndex + 1
    while (next < exercise.questions.length && latestResults[next] !== null) next++
    if (next >= exercise.questions.length) {
      next = 0
      while (next < exercise.questions.length && latestResults[next] !== null) next++
    }
    setCurrentIndex(next)
  }

  // ── FINISHED ──
  if (finished) {
    const score = results.filter(r => r === true).length
    const pct = Math.round((score / exercise.questions.length) * 100)
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-xl font-bold text-[#416ebe]">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            You scored {score}/{exercise.questions.length} ({pct}%)
          </p>
        </div>
        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const correct = results[i] === true
            const isSentence = isSentenceMode(q.word)
            return (
              <div key={q.id} className={`bg-white rounded-xl border-2 p-4 ${correct ? 'border-green-200' : 'border-red-200'}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${correct ? 'text-green-500' : 'text-red-400'}`}>
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    {q.clue && <p className="text-xs text-gray-400 mb-1">{q.clue}</p>}
                    <p className={`text-sm font-bold ${correct ? 'text-green-600' : 'text-red-400'}`}>
                      {isSentence ? q.word : q.word.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={onBack} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2">
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ── ACTIVE ──
  const tileMinW = sentenceMode ? 'min-w-[3rem]' : 'w-10'
  const tileH = 'h-12'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors">← Back</button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#416ebe]">{exercise.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div className="h-full bg-[#416ebe] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{answeredCount} / {exercise.questions.length}</span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-2">
          {sentenceMode ? 'Sentence' : 'Word'} {currentIndex + 1}
        </p>

        {current.image_url && (
          <img src={current.image_url} alt="" className="max-h-48 max-w-full object-contain rounded-xl mb-3" />
        )}

        {current.clue && (
          <p className="text-sm text-[#46464b] mb-4 bg-[#e6f0fa] rounded-lg p-3">{current.clue}</p>
        )}

        {/* Answer area — drop zone */}
        <div
          className={`flex flex-wrap justify-center gap-1.5 mb-6 min-h-[56px] p-3 rounded-xl border-2 border-dashed transition-colors ${
            feedback === 'correct'
              ? 'border-green-300 bg-green-50'
              : feedback === 'wrong'
              ? 'border-red-300 bg-red-50'
              : placed.length > 0
              ? 'border-[#416ebe] bg-[#e6f0fa]/30'
              : 'border-gray-300 bg-gray-50'
          } ${shake ? 'animate-bounce' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnPlacedEnd()}
        >
          {placed.length === 0 && (
            <p className="text-xs text-gray-300 self-center">
              {sentenceMode ? 'Tap or drag words here in the correct order' : 'Tap or drag letters here to spell the word'}
            </p>
          )}
          {placed.map((tile, i) => (
            <div
              key={tile.id}
              draggable={feedback === null}
              onDragStart={() => handleDragStart(tile, 'placed')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.stopPropagation(); handleDropOnPlaced(i) }}
              onClick={() => tapPlacedTile(tile)}
              className={`${tileMinW} ${tileH} px-2 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer select-none ${
                sentenceMode ? 'text-sm' : 'text-lg'
              } ${
                feedback === 'correct'
                  ? 'bg-green-100 border-2 border-green-400 text-green-700'
                  : feedback === 'wrong'
                  ? 'bg-red-100 border-2 border-red-400 text-red-700'
                  : 'bg-[#e6f0fa] border-2 border-[#416ebe] text-[#416ebe] hover:bg-[#d0e0f5] active:scale-95'
              }`}
            >
              {tile.text}
            </div>
          ))}
        </div>

        {/* Scrambled tiles — pool */}
        <div
          className="flex flex-wrap justify-center gap-2 min-h-[48px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnPool()}
        >
          {pool.map((tile) => (
            <button
              key={tile.id}
              draggable={feedback === null}
              onDragStart={() => handleDragStart(tile, 'pool')}
              onClick={() => tapPoolTile(tile)}
              disabled={feedback !== null}
              className={`${tileMinW} ${tileH} px-3 rounded-xl font-bold transition-all select-none ${
                sentenceMode ? 'text-sm' : 'text-lg'
              } ${
                feedback !== null
                  ? 'bg-gray-100 border-2 border-gray-200 text-gray-300 cursor-default'
                  : 'bg-[#416ebe] border-2 border-[#3560b0] text-white hover:bg-[#3560b0] active:scale-95 shadow-sm cursor-pointer'
              }`}
            >
              {tile.text}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        {feedback === null && (
          <div className="flex flex-col items-center gap-2 mt-4">
            {placed.length === targetLength && (
              <button
                onClick={submitAnswer}
                className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-sm"
              >
                Submit
              </button>
            )}
            <div className="flex justify-center gap-3">
              <button onClick={resetTiles} className="text-xs text-gray-400 hover:text-[#416ebe] font-bold px-3 py-1.5 rounded-lg hover:bg-[#e6f0fa] transition-colors">
                Reset
              </button>
              <button onClick={showAnswer} className="text-xs text-gray-400 hover:text-amber-500 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                Show answer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback === 'correct' && (
        <p className="text-sm font-bold text-green-600 text-center animate-pulse">✓ Correct!</p>
      )}

      {feedback === 'wrong' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-sm text-red-500 font-bold mb-1">
            {revealed ? 'The answer is:' : 'Not quite right.'}
          </p>
          <p className="text-sm text-[#46464b] font-bold">
            {sentenceMode ? current.word : current.word.toUpperCase()}
          </p>
        </div>
      )}

      {/* Next button after feedback */}
      {feedback !== null && feedback === 'wrong' && (
        <button onClick={() => advance(results)} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors">
          Next →
        </button>
      )}

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 py-2">
        {exercise.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[#416ebe] scale-125'
                : results[i] === true
                ? 'bg-green-400'
                : results[i] === false
                ? 'bg-red-400'
                : 'bg-[#cddcf0]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
