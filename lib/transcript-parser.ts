// ═══════════════════════════════════════════════════════════════
// VTT Transcript Parser — converts Zoom closed captions to
// clean [TRAINER]/[STUDENT] tagged text for Claude processing
// ═══════════════════════════════════════════════════════════════

type TranscriptLine = {
  speaker: string
  text: string
}

/**
 * Parse a Zoom VTT file into structured lines with speaker labels.
 *
 * Zoom VTT format:
 *   WEBVTT
 *
 *   1
 *   00:00:03.450 --> 00:00:06.820
 *   Speaker Name: Hello everyone.
 *
 *   2
 *   00:00:07.100 --> 00:00:10.350
 *   Another Person: Hi, how are you?
 */
export function parseVTT(vttContent: string): TranscriptLine[] {
  const lines: TranscriptLine[] = []

  // Split into cue blocks (separated by blank lines)
  const blocks = vttContent.split(/\n\s*\n/)

  for (const block of blocks) {
    const blockLines = block.trim().split('\n')

    let foundTimestamp = false
    const textParts: string[] = []

    for (const line of blockLines) {
      const trimmed = line.trim()
      if (trimmed.includes('-->')) {
        foundTimestamp = true
      } else if (foundTimestamp && trimmed && !/^\d+$/.test(trimmed) && trimmed !== 'WEBVTT') {
        textParts.push(trimmed)
      }
    }

    if (!foundTimestamp || textParts.length === 0) continue

    const fullText = textParts.join(' ')

    // Parse "Speaker Name: actual text" — match up to the FIRST colon
    const colonIdx = fullText.indexOf(':')
    if (colonIdx > 0 && colonIdx < 60) {
      // Reasonable speaker name length (< 60 chars before the colon)
      lines.push({
        speaker: fullText.slice(0, colonIdx).trim(),
        text: fullText.slice(colonIdx + 1).trim(),
      })
    } else {
      lines.push({
        speaker: 'Unknown',
        text: fullText,
      })
    }
  }

  return lines
}

/**
 * Normalize speaker labels to [TRAINER] / [STUDENT] and produce
 * a clean transcript string suitable for Claude processing.
 *
 * The trainer's Zoom display name is always "English with Laura"
 * (across all 6 shared accounts). Everything else is a student.
 */
export function normalizeTranscript(
  lines: TranscriptLine[],
  trainerPatterns: string[] = ['english with laura']
): string {
  const patterns = trainerPatterns.map((p) => p.toLowerCase())

  const parts: string[] = []
  let lastLabel = ''

  for (const line of lines) {
    if (!line.text) continue

    const speakerLower = line.speaker.toLowerCase()
    const isTrainer = patterns.some(
      (p) => speakerLower.includes(p) || p.includes(speakerLower)
    )
    const label = isTrainer ? '[TRAINER]' : '[STUDENT]'

    if (label !== lastLabel) {
      parts.push(`\n${label}: ${line.text}`)
      lastLabel = label
    } else {
      // Same speaker continues — append text
      parts.push(line.text)
    }
  }

  return parts.join(' ').trim()
}
